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
import { CORE_HASH_STRUCTURE } from '../../../../../MetaModelConst';
import { hashString } from '@finos/legend-shared';
import {
  PackageableElementExplicitReference,
  type PackageableElementReference,
  type PackageableElementImplicitReference,
} from '../PackageableElementReference';
import type { Profile } from './Profile';
import type { Tag } from './Tag';
import type { Stubable } from '../../../../../helpers/Stubable';
import { ReferenceWithOwner } from '../../Reference';

export abstract class TagReference
  extends ReferenceWithOwner
  implements Stubable
{
  override readonly ownerReference: PackageableElementReference<Profile>;
  value: Tag;

  protected constructor(
    ownerReference: PackageableElementReference<Profile>,
    value: Tag,
  ) {
    super(ownerReference);

    makeObservable(this, {
      value: observable,
      setValue: action,
      isStub: computed,
      pointerHashCode: computed,
    });

    this.ownerReference = ownerReference;
    this.value = value;
  }

  setValue(value: Tag): void {
    this.value = value;
    this.ownerReference.setValue(value.owner);
  }

  get isStub(): boolean {
    return !this.value.isStub;
  }

  get pointerHashCode(): string {
    return [
      CORE_HASH_STRUCTURE.TAG_POINTER,
      this.value.value,
      this.ownerReference.hashValue,
    ]
      .map(hashString)
      .join(',');
  }
}

export class TagExplicitReference extends TagReference {
  override readonly ownerReference: PackageableElementExplicitReference<Profile>;

  private constructor(value: Tag) {
    const ownerReference = PackageableElementExplicitReference.create(
      value.owner,
    );
    super(ownerReference, value);
    this.ownerReference = ownerReference;
  }

  static create(value: Tag): TagExplicitReference {
    return new TagExplicitReference(value);
  }
}

export class TagImplicitReference extends TagReference {
  override readonly ownerReference: PackageableElementImplicitReference<Profile>;

  private constructor(
    ownerReference: PackageableElementImplicitReference<Profile>,
    value: Tag,
  ) {
    super(ownerReference, value);
    this.ownerReference = ownerReference;
  }

  static create(
    ownerReference: PackageableElementImplicitReference<Profile>,
    value: Tag,
  ): TagImplicitReference {
    return new TagImplicitReference(ownerReference, value);
  }
}
