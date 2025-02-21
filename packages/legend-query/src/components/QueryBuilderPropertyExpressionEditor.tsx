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

import { useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import { clsx, InfoCircleIcon } from '@finos/legend-art';
import { observer } from 'mobx-react-lite';
import { QueryBuilderValueSpecificationEditor } from './QueryBuilderValueSpecificationEditor';
import {
  getPropertyPath,
  type QueryBuilderDerivedPropertyExpressionState,
  type QueryBuilderPropertyExpressionState,
} from '../stores/QueryBuilderPropertyEditorState';
import { type DropTargetMonitor, useDrop } from 'react-dnd';
import {
  QUERY_BUILDER_EXPLORER_TREE_DND_TYPE,
  type QueryBuilderExplorerTreeDragSource,
  type QueryBuilderExplorerTreePropertyNodeData,
} from '../stores/QueryBuilderExplorerState';
import { QueryBuilderPropertyInfoTooltip } from './QueryBuilderPropertyInfoTooltip';
import {
  type ValueSpecification,
  Class,
  Enumeration,
  PrimitiveType,
} from '@finos/legend-graph';

const DerivedPropertyExpressionEditor = observer(
  (props: {
    derivedPropertyExpressionState: QueryBuilderDerivedPropertyExpressionState;
  }) => {
    const { derivedPropertyExpressionState } = props;
    const parameterValues = derivedPropertyExpressionState.parameterValues;
    const parameters = derivedPropertyExpressionState.parameters;

    return (
      <div className="query-builder-property-editor__section">
        <div className="panel__content__form__section__header__label">
          {derivedPropertyExpressionState.title}
        </div>
        {!parameterValues.length && (
          <div className="query-builder-property-editor__section__content--empty">
            No parameter
          </div>
        )}
        {parameters.map((variable, idx) => (
          <div key={variable.name} className="panel__content__form__section">
            <div className="panel__content__form__section__header__label">
              {variable.name}
            </div>
            <div className="panel__content__form__section__header__prompt">{`${
              variable.multiplicity.lowerBound === 0 ? 'optional' : ''
            }`}</div>
            <QueryBuilderValueSpecificationEditor
              valueSpecification={parameterValues[idx] as ValueSpecification}
              graph={
                derivedPropertyExpressionState.queryBuilderState
                  .graphManagerState.graph
              }
              expectedType={
                derivedPropertyExpressionState.propertyExpression.func
                  .genericType.value.rawType
              }
            />
            <div className="panel__content__form__section__list"></div>
          </div>
        ))}
      </div>
    );
  },
);

export const QueryBuilderPropertyExpressionEditor = observer(
  (props: { propertyExpressionState: QueryBuilderPropertyExpressionState }) => {
    const { propertyExpressionState } = props;
    const handleClose = (): void =>
      propertyExpressionState.setIsEditingDerivedProperty(false);

    return (
      <Dialog
        open={Boolean(
          propertyExpressionState.isEditingDerivedPropertyExpression,
        )}
        onClose={handleClose}
        classes={{
          root: 'editor-modal__root-container',
          container: 'editor-modal__container',
          paper: 'editor-modal__content',
        }}
      >
        <div className="modal modal--dark editor-modal query-builder-property-editor">
          <div className="modal__header">
            <div className="modal__title">Derived Property</div>
          </div>
          <div className="modal__body query-builder-property-editor__content">
            {propertyExpressionState.derivedPropertyExpressionStates.map(
              (pe) => (
                <DerivedPropertyExpressionEditor
                  key={pe.path}
                  derivedPropertyExpressionState={pe}
                />
              ),
            )}
          </div>
          <div className="modal__footer">
            <button
              className="btn modal__footer__close-btn"
              onClick={handleClose}
            >
              Done
            </button>
          </div>
        </div>
      </Dialog>
    );
  },
);

export const QueryBuilderPropertyExpressionBadge = observer(
  (props: {
    propertyExpressionState: QueryBuilderPropertyExpressionState;
    onPropertyExpressionChange: (
      node: QueryBuilderExplorerTreePropertyNodeData,
    ) => void;
  }) => {
    const { propertyExpressionState, onPropertyExpressionChange } = props;
    const type =
      propertyExpressionState.propertyExpression.func.genericType.value.rawType;
    const hasDerivedPropertyInExpression = Boolean(
      propertyExpressionState.derivedPropertyExpressionStates.length,
    );
    const isValid = propertyExpressionState.isValid;
    const setDerivedPropertyArguments = (): void => {
      if (hasDerivedPropertyInExpression) {
        propertyExpressionState.setIsEditingDerivedProperty(true);
      }
    };
    const handleDrop = useCallback(
      (item: QueryBuilderExplorerTreeDragSource): void =>
        onPropertyExpressionChange(item.node),
      [onPropertyExpressionChange],
    );
    const [{ isPropertyDragOver }, dropConnector] = useDrop(
      () => ({
        accept: [
          QUERY_BUILDER_EXPLORER_TREE_DND_TYPE.ENUM_PROPERTY,
          QUERY_BUILDER_EXPLORER_TREE_DND_TYPE.PRIMITIVE_PROPERTY,
        ],
        drop: (
          item: QueryBuilderExplorerTreeDragSource,
          monitor: DropTargetMonitor,
        ): void => {
          if (!monitor.didDrop()) {
            handleDrop(item);
          } // prevent drop event propagation to accomondate for nested DnD
        },
        collect: (monitor): { isPropertyDragOver: boolean } => ({
          isPropertyDragOver: monitor.isOver({ shallow: true }),
        }),
      }),
      [handleDrop],
    );

    return (
      <div
        ref={dropConnector}
        className="query-builder-property-expression-badge"
      >
        {isPropertyDragOver && (
          <div className="query-builder__dnd__placeholder query-builder-property-expression-badge__dnd__placeholder">
            Change Property
          </div>
        )}
        {!isPropertyDragOver && (
          <div
            className={clsx(
              'query-builder-property-expression-badge__content',
              {
                'query-builder-property-expression-badge__content--class':
                  type instanceof Class,
                'query-builder-property-expression-badge__content--enumeration':
                  type instanceof Enumeration,
                'query-builder-property-expression-badge__content--primitive':
                  type instanceof PrimitiveType,
              },
            )}
          >
            <div
              className="query-builder-property-expression-badge__property"
              title={`${propertyExpressionState.title} - ${propertyExpressionState.path}`}
            >
              {propertyExpressionState.title}
            </div>
            {hasDerivedPropertyInExpression && (
              <button
                className={clsx(
                  'query-builder-property-expression-badge__action',
                  {
                    'query-builder-property-expression-badge__action--error':
                      !isValid,
                  },
                )}
                tabIndex={-1}
                onClick={setDerivedPropertyArguments}
                title="Set Derived Property Argument(s)..."
              >
                {!isValid && <InfoCircleIcon />} (...)
              </button>
            )}
            <QueryBuilderPropertyExpressionEditor
              propertyExpressionState={propertyExpressionState}
            />
            <QueryBuilderPropertyInfoTooltip
              property={propertyExpressionState.propertyExpression.func}
              path={getPropertyPath(propertyExpressionState.propertyExpression)}
              isMapped={true}
              placement="bottom-end"
            >
              <div className="query-builder-property-expression-badge__property__info">
                <InfoCircleIcon />
              </div>
            </QueryBuilderPropertyInfoTooltip>
          </div>
        )}
      </div>
    );
  },
);
