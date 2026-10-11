import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests/browser',fullyParallel:true,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,workers:process.env.CI?2:undefined,timeout:30000,
 reporter:[['list'],['html',{outputFolder:'reports/browser',open:'never'}],['junit',{outputFile:'reports/browser.xml'}]],
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
 projects:['chromium','firefox','webkit'].map(browserName=>({name:browserName,use:{browserName}})),
 webServer:{command:'node tools/test-server.mjs',url:'http://127.0.0.1:4173/tests/browser/harness.html',reuseExistingServer:!process.env.CI,timeout:10000}
});
