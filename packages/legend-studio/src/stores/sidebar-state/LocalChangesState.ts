/**
 * Copyright (c) 2020-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { action, makeAutoObservable, flowResult, flow } from 'mobx';
import format from 'date-fns/format';
import type { EditorStore } from '../EditorStore';
import type { EditorSDLCState } from '../EditorSDLCState';
import { CHANGE_DETECTION_LOG_EVENT } from '../ChangeDetectionLogEvent';
import {
  type GeneratorFn,
  type PlainObject,
  LogEvent,
  assertErrorThrown,
  downloadFileUsingDataURI,
  guaranteeNonNullable,
  ContentType,
  NetworkClientError,
  HttpStatus,
  deleteEntry,
  assertTrue,
  readFileAsText,
} from '@finos/legend-shared';
import {
  DATE_TIME_FORMAT,
  TAB_SIZE,
  ActionAlertType,
  ActionAlertActionType,
} from '@finos/legend-application';
import { EntityDiffViewState } from '../editor-state/entity-diff-editor-state/EntityDiffViewState';
import { SPECIAL_REVISION_ALIAS } from '../editor-state/entity-diff-editor-state/EntityDiffEditorState';
import type { Entity } from '@finos/legend-model-storage';
import { EntityDiff, EntityChange, Revision } from '@finos/legend-server-sdlc';
import { LEGEND_STUDIO_LOG_EVENT_TYPE } from '../LegendStudioLogEvent';

class PatchLoaderState {
  editorStore: EditorStore;
  sdlcState: EditorSDLCState;

  changes: EntityChange[] | undefined;
  currentChanges: EntityChange[] = [];
  isLoadingChanges = false;
  showModal = false;
  isValidPatch = false;

  constructor(editorStore: EditorStore, sdlcState: EditorSDLCState) {
    makeAutoObservable(this, {
      editorStore: false,
      sdlcState: false,
      openModal: action,
      closeModal: action,
      deleteChange: action,
      loadPatchFile: flow,
    });

    this.editorStore = editorStore;
    this.sdlcState = sdlcState;
  }

  openModal(localChanges: EntityChange[]): void {
    this.currentChanges = localChanges;
    this.showModal = true;
  }

  closeModal(): void {
    this.currentChanges = [];
    this.setPatchChanges(undefined);
    this.showModal = false;
  }

  setIsValidPatch(val: boolean): void {
    this.isValidPatch = val;
  }

  setPatchChanges(changes: EntityChange[] | undefined): void {
    this.changes = changes;
  }

  deleteChange(change: EntityChange): void {
    if (this.changes) {
      deleteEntry(this.changes, change);
    }
  }

  get overiddingChanges(): EntityChange[] {
    if (this.changes?.length) {
      return this.changes.filter((change) =>
        this.currentChanges.find(
          (local) => local.entityPath === change.entityPath,
        ),
      );
    }
    return [];
  }

  *loadPatchFile(file: File): GeneratorFn<void> {
    try {
      this.setPatchChanges(undefined);
      assertTrue(
        file.type === ContentType.APPLICATION_JSON,
        `Patch file expected to be of type 'JSON'`,
      );
      const fileText = (yield readFileAsText(file)) as string;
      const entityChanges = JSON.parse(fileText) as {
        entityChanges: PlainObject<EntityChange>[];
      };
      const changes = entityChanges.entityChanges.map((e) =>
        EntityChange.serialization.fromJson(e),
      );
      this.setPatchChanges(changes);
      this.setIsValidPatch(true);
    } catch (error) {
      assertErrorThrown(error);
      this.setIsValidPatch(false);
      this.editorStore.applicationStore.notifyError(
        `Can't load patch: Error: ${error.message}`,
      );
    }
  }

  *applyChanges(): GeneratorFn<void> {
    if (this.changes?.length) {
      this.editorStore.graphState.loadEntityChangesToGraph(this.changes);
      this.closeModal();
    }
  }
}

export class LocalChangesState {
  editorStore: EditorStore;
  sdlcState: EditorSDLCState;
  isSyncingWithWorkspace = false;
  isRefreshingLocalChangesDetector = false;
  patchLoaderState: PatchLoaderState;

  constructor(editorStore: EditorStore, sdlcState: EditorSDLCState) {
    makeAutoObservable(this, {
      editorStore: false,
      sdlcState: false,
      openLocalChange: action,
    });

    this.editorStore = editorStore;
    this.sdlcState = sdlcState;
    this.patchLoaderState = new PatchLoaderState(editorStore, sdlcState);
  }

  openLocalChange(diff: EntityDiff): void {
    const fromEntityGetter = (
      entityPath: string | undefined,
    ): Entity | undefined =>
      entityPath
        ? this.editorStore.changeDetectionState.workspaceLatestRevisionState.entities.find(
            (e) => e.path === entityPath,
          )
        : undefined;
    const toEntityGetter = (
      entityPath: string | undefined,
    ): Entity | undefined => {
      if (!entityPath) {
        return undefined;
      }
      const element =
        this.editorStore.graphManagerState.graph.getNullableElement(entityPath);
      if (!element) {
        return undefined;
      }
      const entity =
        this.editorStore.graphManagerState.graphManager.elementToEntity(
          element,
          true,
        );
      return entity;
    };
    const fromEntity = EntityDiff.shouldOldEntityExist(diff)
      ? guaranteeNonNullable(
          fromEntityGetter(diff.getValidatedOldPath()),
          `Can't find element entity '${diff.oldPath}'`,
        )
      : undefined;
    const toEntity = EntityDiff.shouldNewEntityExist(diff)
      ? guaranteeNonNullable(
          toEntityGetter(diff.getValidatedNewPath()),
          `Can't find element entity '${diff.newPath}'`,
        )
      : undefined;
    this.editorStore.openEntityDiff(
      new EntityDiffViewState(
        this.editorStore,
        SPECIAL_REVISION_ALIAS.WORKSPACE_HEAD,
        SPECIAL_REVISION_ALIAS.LOCAL,
        diff.oldPath,
        diff.newPath,
        fromEntity,
        toEntity,
        fromEntityGetter,
        toEntityGetter,
      ),
    );
  }

  *refreshLocalChanges(): GeneratorFn<void> {
    const startTime = Date.now();
    this.isRefreshingLocalChangesDetector = true;
    try {
      // ======= (RE)START CHANGE DETECTION =======
      this.editorStore.changeDetectionState.stop();
      yield Promise.all([
        this.sdlcState.buildWorkspaceLatestRevisionEntityHashesIndex(),
        this.editorStore.graphManagerState.precomputeHashes(),
      ]);
      this.editorStore.changeDetectionState.start();
      yield flowResult(
        this.editorStore.changeDetectionState.computeLocalChanges(true),
      );
      this.editorStore.applicationStore.log.info(
        LogEvent.create(CHANGE_DETECTION_LOG_EVENT.CHANGE_DETECTION_RESTARTED),
        Date.now() - startTime,
        'ms',
      );
      // ======= FINISHED (RE)START CHANGE DETECTION =======
    } catch (error) {
      assertErrorThrown(error);
      this.editorStore.applicationStore.log.error(
        LogEvent.create(LEGEND_STUDIO_LOG_EVENT_TYPE.SDLC_MANAGER_FAILURE),
        error,
      );
      this.editorStore.applicationStore.notifyError(error);
      this.sdlcState.handleChangeDetectionRefreshIssue(error);
    } finally {
      this.isRefreshingLocalChangesDetector = false;
    }
  }

  downloadLocalChanges = (): void => {
    const fileName = `entityChanges_(${this.sdlcState.currentProject?.name}_${
      this.sdlcState.activeWorkspace.workspaceId
    })_${format(new Date(Date.now()), DATE_TIME_FORMAT)}.json`;
    const content = JSON.stringify(
      {
        message: '', // TODO?
        entityChanges: this.editorStore.graphState.computeLocalEntityChanges(),
        revisionId: this.sdlcState.activeRevision.id,
      },
      undefined,
      TAB_SIZE,
    );
    downloadFileUsingDataURI(fileName, content, ContentType.APPLICATION_JSON);
  };

  *syncWithWorkspace(syncMessage?: string): GeneratorFn<void> {
    if (
      this.isSyncingWithWorkspace ||
      this.editorStore.workspaceUpdaterState.isUpdatingWorkspace
    ) {
      return;
    }
    // check if the workspace is in conflict resolution mode
    try {
      const isInConflictResolutionMode = (yield flowResult(
        this.sdlcState.checkIfCurrentWorkspaceIsInConflictResolutionMode(),
      )) as boolean;
      if (isInConflictResolutionMode) {
        this.editorStore.setBlockingAlert({
          message: 'Workspace is in conflict resolution mode',
          prompt: 'Please refresh the application',
        });
        return;
      }
    } catch (error) {
      assertErrorThrown(error);
      this.editorStore.applicationStore.notifyWarning(
        'Failed to check if current workspace is in conflict resolution mode',
      );
      return;
    }

    const startTime = Date.now();
    const localChanges =
      this.editorStore.graphState.computeLocalEntityChanges();
    if (!localChanges.length) {
      return;
    }
    this.isSyncingWithWorkspace = true;
    const currentHashesIndex =
      this.editorStore.changeDetectionState.snapshotLocalEntityHashesIndex();
    try {
      const latestRevision = Revision.serialization.fromJson(
        (yield this.editorStore.sdlcServerClient.performEntityChanges(
          this.sdlcState.activeProject.projectId,
          this.sdlcState.activeWorkspace,
          {
            message:
              syncMessage ??
              `syncing with workspace from ${
                this.editorStore.applicationStore.config.appName
              } [potentially affected ${
                localChanges.length === 1
                  ? '1 entity'
                  : `${localChanges.length} entities`
              }]`,
            entityChanges: localChanges,
            revisionId: this.sdlcState.activeRevision.id,
          },
        )) as PlainObject<Revision>,
      );
      this.sdlcState.setCurrentRevision(latestRevision); // update current revision to the latest
      const syncFinishedTime = Date.now();

      this.editorStore.applicationStore.log.info(
        LogEvent.create(LEGEND_STUDIO_LOG_EVENT_TYPE.WORKSPACE_SYNCED),
        syncFinishedTime - startTime,
        'ms',
      );

      // ======= (RE)START CHANGE DETECTION =======
      this.editorStore.changeDetectionState.stop();
      try {
        /**
         * Here we try to rebuild local hash index. If failed, we will use local hash index, but for veracity, it's best to use entities
         * coming from the server.
         */
        const entities =
          (yield this.editorStore.sdlcServerClient.getEntitiesByRevision(
            this.sdlcState.activeProject.projectId,
            this.sdlcState.activeWorkspace,
            latestRevision.id,
          )) as Entity[];
        this.editorStore.changeDetectionState.workspaceLatestRevisionState.setEntities(
          entities,
        );
        yield flowResult(
          this.editorStore.changeDetectionState.workspaceLatestRevisionState.buildEntityHashesIndex(
            entities,
            LogEvent.create(
              CHANGE_DETECTION_LOG_EVENT.CHANGE_DETECTION_LOCAL_HASHES_INDEX_BUILT,
            ),
          ),
        );
        this.editorStore.refreshCurrentEntityDiffEditorState();
      } catch (error) {
        assertErrorThrown(error);
        /**
         * NOTE: there is a known problem with the SDLC server where if we try to fetch the entities right after syncing, there is a chance
         * that we get entities from the older commit (i.e. potentially some caching issue). As such, to account for this case, we will
         * not try to get entities for the workspace HEAD, but for the revision returned from the syncing call (i.e. this must be the latest revision)
         * if we get a 404, we will do a refresh and warn user about this. Otherwise, if we get other types of error, we will assume this is a network
         * failure and use local workspace hashes index
         */
        if (error instanceof NetworkClientError) {
          if (error.response.status === HttpStatus.NOT_FOUND) {
            this.editorStore.applicationStore.log.error(
              LogEvent.create(
                LEGEND_STUDIO_LOG_EVENT_TYPE.SDLC_MANAGER_FAILURE,
              ),
              `Can't fetch entities for the latest workspace revision immediately after syncing`,
              error,
            );
          }
          this.editorStore.setActionAltertInfo({
            message: `Change detection engine failed to build hashes index for workspace after syncing`,
            prompt:
              'To fix this, you can either try to keep refreshing local changes until success or trust and reuse current workspace hashes index',
            type: ActionAlertType.CAUTION,
            onEnter: (): void => this.editorStore.setBlockGlobalHotkeys(true),
            onClose: (): void => this.editorStore.setBlockGlobalHotkeys(false),
            actions: [
              {
                label: 'Use local hashes index',
                type: ActionAlertActionType.PROCEED_WITH_CAUTION,
                handler: (): void => {
                  this.editorStore.changeDetectionState.workspaceLatestRevisionState.setEntityHashesIndex(
                    currentHashesIndex,
                  );
                  this.editorStore.changeDetectionState.workspaceLatestRevisionState.setIsBuildingEntityHashesIndex(
                    false,
                  );
                },
              },
              {
                label: 'Refresh changes',
                type: ActionAlertActionType.STANDARD,
                default: true,
                handler: (): Promise<void> =>
                  flowResult(this.refreshLocalChanges()),
              },
            ],
          });
        } else {
          throw error;
        }
      }
      yield flowResult(this.editorStore.graphManagerState.precomputeHashes());
      this.editorStore.changeDetectionState.start();
      yield Promise.all([
        this.editorStore.changeDetectionState.computeLocalChanges(true),
        this.editorStore.changeDetectionState.computeAggregatedWorkspaceChanges(
          true,
        ),
      ]);
      this.editorStore.applicationStore.log.info(
        LogEvent.create(CHANGE_DETECTION_LOG_EVENT.CHANGE_DETECTION_RESTARTED),
        Date.now() - syncFinishedTime,
        'ms',
      );
      // ======= FINISHED (RE)START CHANGE DETECTION =======
    } catch (error) {
      assertErrorThrown(error);
      this.editorStore.applicationStore.log.error(
        LogEvent.create(LEGEND_STUDIO_LOG_EVENT_TYPE.SDLC_MANAGER_FAILURE),
        error,
      );
      if (
        error instanceof NetworkClientError &&
        error.response.status === HttpStatus.CONFLICT
      ) {
        // NOTE: a confict here indicates that the reference revision ID sent along with update call
        // does not match the HEAD of the workspace, therefore, we need to prompt user to refresh the application
        this.editorStore.applicationStore.notifyWarning(
          'Syncing failed. Current workspace revision is not the latest. Please backup your work and refresh the application',
        );
        // TODO: maybe we should do more here, e.g. prompt the user to download the patch, but that is for later
      } else {
        this.editorStore.applicationStore.notifyError(error);
      }
    } finally {
      this.isSyncingWithWorkspace = false;
    }
  }
}
