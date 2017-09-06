import { Observable, Observer } from 'rxjs';
import { Client } from '../client';
import { Logger } from '../logger';
import { Record } from '../record';

export class List {
  private _list;

  constructor(protected _client: Client, private _name: string) {
    this._list = this._client.client.record.getList(this._name);
  }

  subscribeForEntries(): Observable<string[]> {
    let observable = new Observable<any>((obs: Observer<any>) => {
      let callback = data => obs.next(data.length === 0 ? [] : data);
      this._list.whenReady(() => this._list.subscribe(callback, true));
      return () => this._list.unsubscribe(callback);
    });

    return observable;
  }

  subscribeForData(): Observable<any> {
    return this.subscribeForEntries().switchMap((recordNames: string[]) => {
      let recordObservables = recordNames.map(recordName => this._createRecord(recordName).get());

      return recordObservables.length ? Observable.combineLatest(recordObservables) : Observable.of([]);
    });
  }

  addEntry(entry: string, index?: number): void {
    this._list.addEntry(entry, index);
  }

  removeEntry(entry: string, index?: number): void {
    this._list.removeEntry(entry, index);
  }

  addRecord(data: any, index?: number): Observable<void> {
    let entryId = `${this._name}/${this._client.client.getUid()}`;
    this.addEntry(entryId, index);
    let record = new Record(this._client, entryId);
    return record.set(data);
  }

  discard() {
    this._list.discard();
  }

  recordAdded() {
    let observable = new Observable<any>((obs: Observer<any>) => {
      let callback = (entry, pos) => {
        let record = new Record(this._client, entry);
        record
          .get()
          .take(1)
          .subscribe(data => obs.next({ data: data, position: pos }));
      };

      this._list.on('entry-added', callback);
      return () => this._list.off('entry-added', callback);
    });

    return observable;
  }

  protected _createRecord(recordName: string): Record {
    return new Record(this._client, recordName);
  }
}