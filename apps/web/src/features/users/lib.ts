// Small helper extracted from the AdminCN mailConfig (only piece the users
// list needs), so the port does not pull the whole mail subsystem.
export const getInitialsFromName = (name: string) =>
  name
    .split(" ")
    .map((namePart) => namePart[0] ?? "")
    .join("");
