import { getWhitelist, getSettings } from '../src/lib/storage.js';
(async () => {
  const wl = await getWhitelist();
  const settings = await getSettings();
  console.log("Whitelist:", wl);
  console.log("Settings:", settings);
})();
