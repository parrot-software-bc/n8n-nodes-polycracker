const fs = require('fs');
const path = require('path');

function copySvgs(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			copySvgs(full);
		} else if (entry.name.endsWith('.svg')) {
			const rel = path.relative('nodes', full);
			const dest = path.join('dist', 'nodes', rel);
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(full, dest);
		}
	}
}

copySvgs('nodes');
