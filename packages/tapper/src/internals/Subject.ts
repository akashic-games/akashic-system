import { Disposable, Observable, Observer } from "../DataTypes";

/**
 * rx.js互換のSubject
 */
export class Subject<T> implements Observable<T>, Observer<T> {
	private _isStopped = false;
	private _observers: Observer<T>[] = [];
	private _error: any;
	private _hasError = false;
	public subscribe(observer: Observer<T>): Disposable {
		if (!this._isStopped) {
			this._observers.push(observer);
			return {
				dispose: () => this._observers.splice(this._observers.indexOf(observer), 1),
			};
		}
		if (this._hasError) {
			observer.onError(this._error);
			return {
				dispose: () => {
					// do nothing
				},
			};
		}
		observer.onCompleted();
		return {
			dispose: () => {
				// do nothing
			},
		};
	}
	public onNext(value: T): void {
		if (!this._isStopped) {
			const observers = this._observers.concat();
			for (const observer of observers) {
				observer.onNext(value);
			}
		}
	}
	public onError(error: any): void {
		if (!this._isStopped) {
			this._isStopped = true;
			this._error = error;
			this._hasError = true;
			const observers = this._observers.concat();
			for (const observer of observers) {
				observer.onError(error);
			}
			this._observers = [];
		}
	}
	public onCompleted(): void {
		if (!this._isStopped) {
			this._isStopped = true;
			const observers = this._observers.concat();
			for (const observer of observers) {
				observer.onCompleted();
			}
			this._observers = [];
		}
	}
}
