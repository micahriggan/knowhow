export interface Plugin {
  call(user_input?: string): Promise<string>;
}

