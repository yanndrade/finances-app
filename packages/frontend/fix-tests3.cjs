const fs = require('fs');

const appTestPath = 'src/App.test.tsx';
let appTest = fs.readFileSync(appTestPath, 'utf8');

appTest = appTest.replace(
  /await userEvent\.click\(screen\.getByRole\("button", \{ name: \/gerenciar\/i \}\)\);/g,
  'await userEvent.click(await screen.findByRole("button", { name: /gerenciar/i }));'
);

appTest = appTest.replace(
  /expect\(screen\.getByRole\("button", \{ name: \/gerenciar\/i \}\)\)\.toBeInTheDocument\(\);/g,
  'expect(await screen.findByRole("button", { name: /gerenciar/i })).toBeInTheDocument();'
);

fs.writeFileSync(appTestPath, appTest);


const uiTestPath = 'src/ui-consistency-and-cards-overview.test.tsx';
let uiTest = fs.readFileSync(uiTestPath, 'utf8');

uiTest = uiTest.replace(
  /await userEvent\.click\(screen\.getByRole\("button", \{ name: \/cart\/i \}\)\);/g,
  'await screen.findByRole("heading", { level: 1, name: /vis/i });\n    await userEvent.click(screen.getByRole("button", { name: /^cartões$/i }));'
);

fs.writeFileSync(uiTestPath, uiTest);

console.log("Fixed tests 3");
