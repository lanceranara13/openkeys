/** Where the project lives. Every link to GitHub is built from this one address. */
export const REPO_URL = 'https://github.com/lanceranara13/openkeys';

/** The "Add a keyboard" form, defined in .github/ISSUE_TEMPLATE/add-keyboard.yml. */
export const ADD_KEYBOARD_URL = `${REPO_URL}/issues/new?template=add-keyboard.yml`;

export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;

/** A file of the repository, as GitHub shows it: `fileUrl('docs/adding-a-driver.md')`. */
export const fileUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;
