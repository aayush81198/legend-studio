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
import { hashArray, uuid, type Hashable } from '@finos/legend-shared';
import { CORE_HASH_STRUCTURE } from '../../../../../MetaModelConst';
import type { Tag } from './Tag';
import type { Stubable } from '../../../../../helpers/Stubable';
import { type TagReference, TagExplicitReference } from './TagReference';

export class TaggedValue implements Hashable, Stubable {
  uuid = uuid();
  tag: TagReference;
  value: string;

  constructor(tag: TagReference, value: string) {
    makeObservable(this, {
      value: observable,
      setTag: action,
      setValue: action,
      isStub: computed,
      hashCode: computed,
    });

    this.tag = tag;
    this.value = value;
  }

  setTag(tag: Tag): void {
    this.tag.setValue(tag);
  }
  setValue(value: string): void {
    this.value = value;
  }

  static createStub = (tag: Tag): TaggedValue =>
    new TaggedValue(TagExplicitReference.create(tag), '');
  get isStub(): boolean {
    return !this.value && this.tag.isStub;
  }

  get hashCode(): string {
    return hashArray([
      CORE_HASH_STRUCTURE.TAGGED_VALUE,
      this.tag.pointerHashCode,
      this.value,
    ]);
  }
}
