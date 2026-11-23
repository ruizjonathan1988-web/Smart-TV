// Ce qu'il faut au dessin des ouvertures, fait une fois (le _Kit de
// vjod_intro.dart) : le logo et ses teintes, son contour en grille de cases,
// les caractères du terminal, et quelques images de neige.
import logoUrl from './vjod_intro_logo.png';

export const ASPECT = 1024 / 572;
export const GLYPHS = '01ABCDEF23456789#$%&*+=<>/\\|{}[]VJOD';
export const MONO = '"Roboto Mono", "Droid Sans Mono", "DejaVu Sans Mono", "Courier New", monospace';

// Un hasard qui donne toujours la même suite (le Random(4) de l'APK).
export const seeded = (seed) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const canvas = (w, h) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return c;
};

const loadImage = (src) => new Promise((resolve, reject) => {
	const img = new window.Image();
	img.onload = () => resolve(img);
	img.onerror = reject;
	img.src = src;
});

const alphaGrid = (img, w, h) => {
	const c = canvas(w, h);
	const x = c.getContext('2d');
	x.drawImage(img, 0, 0, w, h);
	return x.getImageData(0, 0, w, h).data;
};

// Le logo recoloré : cyan (le rouge passe dans le vert et le bleu) ou doré.
const tinted = (img, kind) => {
	const c = canvas(img.width, img.height);
	const x = c.getContext('2d');
	x.drawImage(img, 0, 0);
	const data = x.getImageData(0, 0, c.width, c.height);
	const p = data.data;
	for (let i = 0; i < p.length; i += 4) {
		const r = p[i];
		if (kind === 'cyan') {
			p[i] = 0;
			p[i + 1] = r;
			p[i + 2] = r;
		} else {
			p[i + 1] = Math.round(r * 0.6);
			p[i + 2] = 0;
		}
	}
	x.putImageData(data, 0, 0);
	return c;
};

// Les caractères côte à côte, d'une couleur, pour les dessiner par morceaux.
const atlas = (color, gw, gh, size) => {
	const c = canvas(Math.ceil(gw * GLYPHS.length), Math.ceil(gh));
	const x = c.getContext('2d');
	x.font = `${size}px ${MONO}`;
	x.textBaseline = 'top';
	x.textAlign = 'center';
	x.fillStyle = color;
	for (let i = 0; i < GLYPHS.length; i++) x.fillText(GLYPHS[i], i * gw + gw / 2, 0);
	return c;
};

const snowFrame = (rnd) => {
	const w = 320, h = 180;
	const c = canvas(w, h);
	const x = c.getContext('2d');
	const data = x.createImageData(w, h);
	const p = data.data;
	for (let i = 0; i < w * h; i++) {
		const v = Math.floor(rnd() * 256);
		p[i * 4] = v;
		p[i * 4 + 1] = v;
		p[i * 4 + 2] = v;
		p[i * 4 + 3] = 255;
	}
	x.putImageData(data, 0, 0);
	return c;
};

let cache = null;

export const loadKit = () => {
	if (cache) return cache;
	cache = loadImage(logoUrl).then((logo) => {
		const rnd = seeded(4);
		const cols = 110;
		const rows = Math.round(cols / ASPECT * 1.8);
		const grid = alphaGrid(logo, cols, rows);
		const cells = [];
		for (let r = 0; r < rows; r++) {
			for (let q = 0; q < cols; q++) {
				const a = grid[(r * cols + q) * 4 + 3];
				if (a > 110) {
					const ang = rnd() * Math.PI * 2, dist = 0.7 + rnd() * 0.8;
					cells.push({q, r, a: a / 255, rnd: rnd(), sx: Math.cos(ang) * dist, sy: Math.sin(ang) * dist * 0.7, delay: rnd() * 0.45, seed: cells.length});
				}
			}
		}
		const aCols = 64;
		const aRows = Math.round(aCols / ASPECT * 0.55);
		const ag = alphaGrid(logo, aCols, aRows);
		const ascii = [];
		for (let i = 0; i < aCols * aRows; i++) {
			const a = ag[i * 4 + 3] / 255;
			ascii.push(a > 0.75 ? 1 : a > 0.5 ? 0.75 : a > 0.28 ? 0.5 : a > 0.1 ? 0.25 : 0);
		}
		const gs = 48;
		const probe = canvas(8, 8).getContext('2d');
		probe.font = `${gs}px ${MONO}`;
		let gw = 0;
		for (const ch of GLYPHS) gw = Math.max(gw, probe.measureText(ch).width);
		gw = Math.ceil(gw);
		const gh = Math.ceil(gs * 1.15);
		// Le rose de « La plateforme » va du blanc au rouge : quelques teintes.
		const pinks = [90, 130, 170, 210].map((v) => atlas(`rgb(255,${v},${v})`, gw, gh, gs));
		const rain = [];
		for (let i = 0; i < 70; i++) rain.push({x: rnd(), s: 0.25 + rnd() * 0.6, o: rnd()});
		return {
			logo,
			cyan: tinted(logo, 'cyan'),
			gold: tinted(logo, 'gold'),
			glyphW: gw,
			glyphH: gh,
			white: atlas('#ffffff', gw, gh, gs),
			red: atlas('#E50914', gw, gh, gs),
			pinks,
			snow: [snowFrame(rnd), snowFrame(rnd), snowFrame(rnd), snowFrame(rnd)],
			cols, rows, cells, asciiCols: aCols, asciiRows: aRows, ascii, rain,
			scratch: canvas(logo.width, logo.height)
		};
	});
	cache.catch(() => {
		cache = null;
	});
	return cache;
};
