import { defaults } from './configuration.js';
import { cliConfiguration } from './cli.js';
import { projectConfiguration } from './project.js';

function mergeSettings(base, overrides) {
  const settings = new Map(Object.entries(base));
  for (const [key, value] of Object.entries(overrides)) {
    if (Array.isArray(value)) {
      settings.set(key, Object.freeze([...value]));
    } else if (value !== null && typeof value === 'object') {
      settings.set(key, mergeSettings(settings.get(key) ?? {}, value));
    } else {
      settings.set(key, value);
    }
  }
  return Object.freeze(Object.fromEntries(settings));
}

/**
 * Providers return nested sections with scalar settings or arrays of scalars.
 * Later providers take precedence for each setting.
 */
export function createConfigurationResolver(...providers) {
  return async (context = {}) => {
    let configuration = Object.freeze({});
    for (const provide of providers) {
      configuration = mergeSettings(configuration, await provide(context));
    }
    return configuration;
  };
}

export const resolveConfiguration = createConfigurationResolver(
  () => defaults,
  projectConfiguration,
  cliConfiguration,
);
