import { supabase } from "./supabase";

export async function invokeFunction<TPayload, TResponse>(
  name: string,
  payload: TPayload,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke<TResponse>(name, {
    body: payload as Record<string, unknown>,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Function ${name} returned no data`);
  }

  return data;
}
