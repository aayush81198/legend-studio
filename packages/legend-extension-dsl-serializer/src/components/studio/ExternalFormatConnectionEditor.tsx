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

import {
  type EditorStore,
  ConnectionValueState,
  NewConnectionValueDriver,
} from '@finos/legend-studio';
import { ExternalFormatConnection } from '../../models/metamodels/pure/model/packageableElements/connection/ExternalFormatConnection';
import { observer } from 'mobx-react-lite';
import { PackageableElementExplicitReference } from '@finos/legend-graph';
import { computed, makeObservable } from 'mobx';
import type { Binding } from '../../models/metamodels/pure/model/packageableElements/store/Binding';
import { UrlStream } from '../../models/metamodels/pure/model/packageableElements/connection/UrlStream';

export class ExternalFormatConnectionValueState extends ConnectionValueState {
  override connection: ExternalFormatConnection;

  constructor(editorStore: EditorStore, connection: ExternalFormatConnection) {
    super(editorStore, connection);
    this.connection = connection;
  }

  label(): string {
    return 'external format connection';
  }
}

export const ExternalFormatConnectionEditor = observer(
  (props: {
    connectionValueState: ExternalFormatConnectionValueState;
    isReadOnly: boolean;
  }) => {
    const { connectionValueState, isReadOnly } = props;
    const connection = connectionValueState.connection;
    const changeUrl: React.ChangeEventHandler<HTMLTextAreaElement> = (event) =>
      connection.externalSource.setUrl(event.target.value);
    return (
      <div className="external-format-connection-editor">
        <div className="external-format-connection-editor__section">
          <div className="external-format-connection-editor__section__header__label">
            URL
          </div>
          <div className="external-format-connection-editor__section__header__prompt">
            Specifies the connection URL
          </div>
          <textarea
            className="external-format-connection-editor__section__textarea"
            spellCheck={false}
            value={connection.externalSource.url}
            onChange={changeUrl}
            disabled={isReadOnly}
          />
        </div>
      </div>
    );
  },
);

export class NewExternalFormatConnectionDriver extends NewConnectionValueDriver<ExternalFormatConnection> {
  constructor(editorStore: EditorStore) {
    super(editorStore);

    makeObservable(this, {
      isValid: computed,
    });
  }

  get isValid(): boolean {
    return true;
  }

  createConnection(store: Binding): ExternalFormatConnection {
    const externalFormatConnection = new ExternalFormatConnection(
      PackageableElementExplicitReference.create(store),
    );
    const urlStream = new UrlStream();
    urlStream.setUrl('');
    externalFormatConnection.externalSource = urlStream;
    return externalFormatConnection;
  }
}
