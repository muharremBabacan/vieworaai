import { app, db, storage, auth, analytics } from './init';

// 🔥 Centralized exports from init.ts to prevent duplicate initialization
export { app, db, storage, auth, analytics };