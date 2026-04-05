type CallbackStyle<TArgs extends unknown[], TResult> = (
  ...args: [...TArgs, (error: unknown, result?: TResult) => void]
) => void;

function inspect(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function promisify<TArgs extends unknown[], TResult>(
  callbackStyle: CallbackStyle<TArgs, TResult>,
) {
  return (...args: TArgs) => new Promise<TResult>((resolve, reject) => {
    callbackStyle(...args, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result as TResult);
    });
  });
}

const util = {
  inspect,
  promisify,
};

export { inspect, promisify };
export default util;
