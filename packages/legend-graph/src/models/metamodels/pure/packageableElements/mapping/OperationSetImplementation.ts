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

import { observable, action, computed, makeObservable } from 'mobx';
import {
  type Hashable,
  hashArray,
  guaranteeNonNullable,
  addUniqueEntry,
  deleteEntry,
  changeEntry,
} from '@finos/legend-shared';
import { CORE_HASH_STRUCTURE } from '../../../../../MetaModelConst';
import type { PackageableElementReference } from '../PackageableElementReference';
import {
  type SetImplementationVisitor,
  SetImplementation,
} from './SetImplementation';
import type { SetImplementationContainer } from './SetImplementationContainer';
import type { Mapping } from './Mapping';
import type { Class } from '../domain/Class';
import { type Stubable, isStubArray } from '../../../../../helpers/Stubable';
import type { InferableMappingElementIdValue } from './InferableMappingElementId';
import type { InferableMappingElementRoot } from './InferableMappingElementRoot';

export enum OperationType {
  STORE_UNION = 'STORE_UNION',
  ROUTER_UNION = 'ROUTER_UNION',
  INHERITANCE = 'INHERITANCE',
  // MERGE = 'MERGE',
}

export const getClassMappingOperationType = (value: string): OperationType =>
  guaranteeNonNullable(
    Object.values(OperationType).find((type) => type === value),
    `Encountered unsupproted class mapping operation type '${value}'`,
  );

export class OperationSetImplementation
  extends SetImplementation
  implements Hashable, Stubable
{
  parameters: SetImplementationContainer[] = [];
  operation: OperationType;

  constructor(
    id: InferableMappingElementIdValue,
    parent: Mapping,
    pureClass: PackageableElementReference<Class>,
    root: InferableMappingElementRoot,
    operation: OperationType,
  ) {
    super(id, parent, pureClass, root);

    makeObservable(this, {
      parameters: observable,
      operation: observable,
      setOperation: action,
      setParameters: action,
      addParameter: action,
      changeParameter: action,
      deleteParameter: action,
      isStub: computed,
      hashCode: computed,
    });

    this.operation = operation;
  }

  setOperation(value: OperationType): void {
    this.operation = value;
  }
  setParameters(value: SetImplementationContainer[]): void {
    this.parameters = value;
  }
  addParameter(value: SetImplementationContainer): void {
    addUniqueEntry(this.parameters, value);
  }
  changeParameter(
    oldValue: SetImplementationContainer,
    newValue: SetImplementationContainer,
  ): void {
    changeEntry(this.parameters, oldValue, newValue);
  }
  deleteParameter(value: SetImplementationContainer): void {
    deleteEntry(this.parameters, value);
  }

  /**
   * Get all leaf impls of an operation Set Implementation. Accounts for loops and duplication (which should be caught by compiler).
   */
  get leafSetImplementations(): SetImplementation[] {
    return this.childSetImplementations.filter(
      (si) => !(si instanceof OperationSetImplementation),
    );
  }

  get childSetImplementations(): SetImplementation[] {
    const visitedOperations = new Set<OperationSetImplementation>();
    visitedOperations.add(this);
    const _leaves = new Set<SetImplementation>();
    const resolveleafSetImps = (
      _opSetImpl: OperationSetImplementation,
    ): void => {
      _opSetImpl.parameters.forEach((p) => {
        const setImp = p.setImplementation.value;
        if (
          setImp instanceof OperationSetImplementation &&
          !visitedOperations.has(setImp)
        ) {
          visitedOperations.add(setImp);
          resolveleafSetImps(setImp);
        } else {
          _leaves.add(setImp);
        }
      });
    };
    resolveleafSetImps(this);
    visitedOperations.delete(this);
    return Array.from(_leaves).concat(Array.from(visitedOperations));
  }

  override get isStub(): boolean {
    return super.isStub && isStubArray(this.parameters);
  }

  override get hashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.OPERATION_SET_IMPLEMENTATION,
      this.operation,
      hashArray(
        this.parameters.map((param) => param.setImplementation.value.id.value),
      ),
    ]);
  }

  accept_SetImplementationVisitor<T>(visitor: SetImplementationVisitor<T>): T {
    return visitor.visit_OperationSetImplementation(this);
  }
}
