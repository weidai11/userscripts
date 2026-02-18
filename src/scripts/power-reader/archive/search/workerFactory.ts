import { SearchWorkerClient } from './protocol';
import SearchWorker from './worker?worker&inline';

export const createSearchWorkerClient = (): SearchWorkerClient =>
  new SearchWorkerClient(new SearchWorker());
