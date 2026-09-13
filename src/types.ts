/**
 * Keeps a mock's inspection helpers while adapting it to an application's
 * generated binding type. Only call binding methods implemented by the mock.
 */
export const asBinding = <Binding>() =>
  <Mock>(mock: Mock) => mock as Mock & Binding;
