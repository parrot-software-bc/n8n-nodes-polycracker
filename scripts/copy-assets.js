const fs = require('fs');
const path = require('path');

function copySvgs(sourceRoot, destRoot) {
	if (!fs.existsSync(sourceRoot)) {
		return;
	}
	for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
		const full = path.join(sourceRoot, entry.name);
		if (entry.isDirectory()) {
			copySvgs(full, path.join(destRoot, entry.name));
		} else if (entry.name.endsWith('.svg')) {
			fs.mkdirSync(destRoot, { recursive: true });
			fs.copyFileSync(full, path.join(destRoot, entry.name));
		}
	}
}

copySvgs('nodes', path.join('dist', 'nodes'));
copySvgs('credentials', path.join('dist', 'credentials'));
