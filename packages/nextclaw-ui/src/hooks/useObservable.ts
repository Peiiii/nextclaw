import { useEffect, useState } from 'react';
import type { BehaviorSubject, Observable } from 'rxjs';

export function useValueFromBehaviorSubject<T>(subject: BehaviorSubject<T>): T {
  const [state, setState] = useState<T>(subject.getValue());
  useEffect(() => {
    const subscription = subject.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [subject]);
  return state;
}

export function useValueFromObservable<T>(observable: Observable<T>, defaultValue: T): T {
  const [state, setState] = useState<T>(defaultValue);
  useEffect(() => {
    const subscription = observable.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [observable]);
  return state;
}
