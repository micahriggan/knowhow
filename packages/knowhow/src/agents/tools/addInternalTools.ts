// Add new internal tools to the existing suite
export function addInternalTools(fns: {
  [fnName: string]: (...args: any) => any;
}) {
  const callParallel = (
    fnsToCall: { recipient_name: string; parameters: any }[]
  ) => {
    const promises = fnsToCall.map((param) => {
      const name = param.recipient_name.split(".").pop();
      const fn = fns[name];
      const args = Object.values(param.parameters);
      return fn(...args);
    });

    return Promise.all(promises);
  };

  fns["multi_tool_use.parallel"] = callParallel;

  return fns;
}
