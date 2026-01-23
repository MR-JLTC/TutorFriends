// Vite will transform imported asset into a valid URL at build time
// Consumers can use this as <img src={logoBase64} />
// Using import ensures correct path resolution across routes/layouts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import logoUrl from './images/tutorfriends-logo.png';

export const logoBase64 = logoUrl as string;
