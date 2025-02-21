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

import { action, makeAutoObservable } from 'mobx';
import {
  addUniqueEntry,
  getNullableFirstElement,
  isNonNullable,
  uniq,
} from '@finos/legend-shared';
import type { QueryBuilderState } from './QueryBuilderState';
import {
  type Class,
  type Mapping,
  type PackageableRuntime,
  type Runtime,
  type ValueSpecification,
  getMilestoneTemporalStereotype,
  PackageableElementExplicitReference,
  RuntimePointer,
} from '@finos/legend-graph';

export class QueryBuilderSetupState {
  queryBuilderState: QueryBuilderState;
  _class?: Class | undefined;
  classMilestoningTemporalValues: ValueSpecification[] = [];
  mapping?: Mapping | undefined;
  runtime?: Runtime | undefined;
  mappingIsReadOnly = false;
  runtimeIsReadOnly = false;
  showSetupPanel = true;

  constructor(queryBuilderState: QueryBuilderState) {
    makeAutoObservable(this, {
      queryBuilderState: false,
      addClassMilestoningTemporalValues: action,
      setQueryBuilderState: action,
      setClass: action,
      setMapping: action,
      setRuntime: action,
      setClassMilestoningTemporalValues: action,
      setShowSetupPanel: action,
    });

    this.queryBuilderState = queryBuilderState;
  }

  get possibleMappings(): Mapping[] {
    const mappingsWithClassMapped = this.queryBuilderState.mappings.filter(
      (mapping) =>
        mapping.classMappings.some((cm) => cm.class.value === this._class),
    );
    const resolvedMappingIncludes = this.queryBuilderState.mappings.filter(
      (mapping) =>
        mapping.allIncludedMappings.some((e) =>
          mappingsWithClassMapped.includes(e),
        ),
    );
    return this._class
      ? uniq([...mappingsWithClassMapped, ...resolvedMappingIncludes])
      : [];
  }

  get possibleRuntimes(): PackageableRuntime[] {
    return this._class && this.mapping
      ? this.queryBuilderState.runtimes
          .map((packageableRuntime) =>
            packageableRuntime.runtimeValue.mappings.some((mapping) =>
              this.possibleMappings.includes(mapping.value),
            )
              ? packageableRuntime
              : undefined,
          )
          .filter(isNonNullable)
      : [];
  }

  get isMappingCompatible(): boolean {
    if (this.mapping && this._class) {
      return this.possibleMappings.includes(this.mapping);
    }
    return false;
  }

  addClassMilestoningTemporalValues(val: ValueSpecification): void {
    addUniqueEntry(this.classMilestoningTemporalValues, val);
  }

  setQueryBuilderState(queryBuilderState: QueryBuilderState): void {
    this.queryBuilderState = queryBuilderState;
  }
  setRuntime(val: Runtime | undefined): void {
    if (!this.runtimeIsReadOnly) {
      this.runtime = val;
    }
  }
  setShowSetupPanel(val: boolean): void {
    this.showSetupPanel = val;
  }
  setMappingIsReadOnly(val: boolean): void {
    this.mappingIsReadOnly = val;
  }
  setRuntimeIsReadOnly(val: boolean): void {
    this.runtimeIsReadOnly = val;
  }

  setClass(val: Class | undefined, isRebuildingState?: boolean): void {
    this._class = val;
    const isMappingEditable = !isRebuildingState && !this.mappingIsReadOnly;
    if (isMappingEditable && !this.isMappingCompatible) {
      const possibleMapping = getNullableFirstElement(this.possibleMappings);
      if (possibleMapping) {
        this.setMapping(possibleMapping);
      }
    }
    if (val !== undefined) {
      const stereotype = getMilestoneTemporalStereotype(
        val,
        this.queryBuilderState.graphManagerState.graph,
      );
      this.setClassMilestoningTemporalValues([]);
      if (stereotype) {
        this.queryBuilderState.buildClassMilestoningTemporalValue(
          val,
          stereotype,
        );
      }
    }
  }

  setMapping(val: Mapping | undefined): void {
    this.mapping = val;
    const runtimeToPick = getNullableFirstElement(this.possibleRuntimes);
    if (runtimeToPick) {
      this.setRuntime(
        new RuntimePointer(
          PackageableElementExplicitReference.create(runtimeToPick),
        ),
      );
    } else {
      // TODO?: we should consider if we allow people to use custom runtime here
      this.setRuntime(undefined);
    }
  }

  setClassMilestoningTemporalValues(val: ValueSpecification[]): void {
    this.classMilestoningTemporalValues = val;
  }
}
