// Unset arguments and options leave lower-priority settings in place.
export function cliConfiguration({ cli = {} }) {
  return Object.fromEntries(Object.entries(cli).map(([section, values]) => [
    section,
    Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)),
  ]));
}
