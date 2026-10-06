// Lets non-React code (the guided demo runner) navigate with the app's router.
export const routerRef: { navigate: (to: string) => void } = { navigate: (to) => { window.location.assign(to); } };
