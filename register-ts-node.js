import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register ts-node loader
register('ts-node/esm', {
  parentURL: pathToFileURL('./')
}); 