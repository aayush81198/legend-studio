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

import { computed, makeObservable } from 'mobx';
import { hashArray, type Hashable } from '@finos/legend-shared';
import { RelationshipView } from './RelationshipView';
import type { Diagram } from './Diagram';
import type { ClassView } from './ClassView';
import { DIAGRAM_HASH_STRUCTURE } from '../../../../DSLDiagram_ModelUtils';

export class GeneralizationView extends RelationshipView implements Hashable {
  constructor(owner: Diagram, from: ClassView, to: ClassView) {
    super(owner, from, to);

    makeObservable(this, {
      hashCode: computed,
    });
  }

  override get hashCode(): string {
    return hashArray([
      DIAGRAM_HASH_STRUCTURE.GENERALIZATION_VIEW,
      super.hashCode,
    ]);
  }
}
