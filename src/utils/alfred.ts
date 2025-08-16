export function isRunningInAlfred(): boolean {
  return Boolean(
    process.env.alfred_version ||
    process.env.ALFRED_VERSION ||
    process.env.alfred_workflow_bundleid
  );
}


