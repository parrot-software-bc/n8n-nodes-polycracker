const fs = require('fs');
const path = require('path');

function copyAssets(sourceRoot, destRoot) {
	if (!fs.existsSync(sourceRoot)) {
		return;
	}
	for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
		const full = path.join(sourceRoot, entry.name);
		if (entry.isDirectory()) {
			copyAssets(full, path.join(destRoot, entry.name));
		} else if (entry.name.endsWith('.svg') || entry.name.endsWith('.node.json')) {
			fs.mkdirSync(destRoot, { recursive: true });
			fs.copyFileSync(full, path.join(destRoot, entry.name));
		}
	}
}

copyAssets('nodes', path.join('dist', 'nodes'));
copyAssets('credentials', path.join('dist', 'credentials'));
