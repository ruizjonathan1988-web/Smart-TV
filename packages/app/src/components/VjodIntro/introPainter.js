// Le dessin des ouvertures, image par image : la reprise du _IntroPainter de
// vjod_intro.dart en canvas 2D. t est le temps écoulé en secondes.
import {ASPECT, GLYPHS, MONO} from './introKit';

const BLACK = '#040404';
const TRI = {x: 0.786, y: 0.511}; // le bouton lecture dans l'image du logo

export const clamp = (x) => (x < 0 ? 0 : (x > 1 ? 1 : x));

const red = (a) => `rgba(229,9,20,${clamp(a)})`;
const white = (a) => `rgba(255,255,255,${clamp(a)})`;

// Les courbes de Flutter (des cubiques de Bézier), pour le même rythme.
const cubic = (a, b, c, d) => {
	const ev = (p, q, m) => 3 * p * (1 - m) * (1 - m) * m + 3 * q * (1 - m) * m * m + m * m * m;
	return (x) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let lo = 0, hi = 1;
		for (;;) {
			const mid = (lo + hi) / 2;
			const est = ev(a, c, mid);
			if (Math.abs(x - est) < 0.001) return ev(b, d, mid);
			if (est < x) lo = mid;
			else hi = mid;
		}
	};
};
const linear = (x) => x;
export const CURVES = {
	ioc: cubic(0.645, 0.045, 0.355, 1.0),
	oc: cubic(0.215, 0.61, 0.355, 1.0),
	ic: cubic(0.55, 0.055, 0.675, 0.19),
	io: cubic(0.455, 0.03, 0.515, 0.955),
	ei: cubic(0.55, 0.085, 0.68, 0.53),
	back: cubic(0.175, 0.885, 0.32, 1.275)
};
const {ioc, oc, ic, io, ei, back} = CURVES;

export const seg = (t, a, b, c = linear) => c(clamp((t - a) / (b - a)));

// La neige, la pluie de code et les glitchs tirent au hasard à chaque image.
const rand = Math.random;

const pick = (seed) => Math.floor(Math.abs(Math.sin(seed) * 9973)) % GLYPHS.length;

const hexLine = (seed) => {
	let s = '';
	for (let i = 0; i < 16; i++) {
		s += (Math.floor(Math.abs(Math.sin(seed * 13 + i) * 255)) & 255).toString(16).padStart(2, '0') + ' ';
	}
	return s;
};

const CHANS = ['TF1', 'France 2', 'M6', 'Canal+', 'Arte', 'BFM TV', 'W9', 'TMC', 'C8', '6ter',
	'RMC Sport', 'beIN 1', 'France 5', 'LCI', 'Gulli', 'CNews', 'TF1 4K', 'Paris Première', 'Ciné+', 'OCS'];

// Une ligne du torrent de données, la même pour le même i.
export const torrentLine = (i, seed) => {
	const r = (m) => (Math.floor(Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453)) + i * 7) % m;
	switch (i % 6) {
		case 0: return `[ OK ] source ${String(i % 30 + 1).padStart(2, '0')}/30  ${CHANS[r(CHANS.length)]}  ${[720, 1080, 2160][r(3)]}p  ${r(90) + 9} ms`;
		case 1: return `recv 0x${(0x7f3a00 + i * 0x2c0).toString(16)}  ${r(900) + 64} Ko  ${hexLine(i).substring(0, 24)}`;
		case 2: return `seedbox » sync radarr/sonarr  ${r(4000) + 100} fichiers  ${r(980) + 20} Mo/s`;
		case 3: return `decrypt aes-256-gcm  bloc ${r(99999)}  ✓`;
		case 4: return `0x${(0x7f3a00 + i * 16).toString(16)}  ${hexLine(i + seed)}`;
		default: return `jellyfin » index ${r(12000)} médias · ${r(60) + 1} bibliothèques · ok`;
	}
};

const E_LINES = [
	[0.05, '> vjod --connect seedbox'],
	[0.22, '  liaison chiffrée ........ OK'],
	[0.46, '  sources trouvées : 30'],
	[0.68, '> decrypt --signal vjod.4.0'],
	[0.88, '  clé acceptée · déchiffrement…']
];

const G_TERM = [
	[0.02, 0.22, 'root@vjod:~# ', 'ssh seedbox.vjod', 'cmd'],
	[0.26, 0, 'Connexion établie · chiffrement AES-256 · clé 4096 bits', '', 'out'],
	[0.30, 0, 'Bienvenue sur la seedbox de VJOD.', '', 'dim'],
	[0.48, 0.70, 'root@seedbox:~# ', './ma_tv --sources 30 --check', 'cmd'],
	[0.74, 0.98, '', '', 'bar'],
	[1.02, 1.18, 'root@seedbox:~# ', 'cat /dev/vjod | decrypt --ascii', 'cmd'],
	[1.22, 0, '', '', 'hex']
];

const SLICES = [[0, 0.27], [0.27, 0.44], [0.44, 0.685], [0.685, 1]];
const BEATS = [1.0, 1.18, 1.36, 1.54];

// Le drop, calé sur sa musique : drum'n'bass jump-up à 174 BPM. Deux mesures
// qui montent (le dernier temps vide), quatre mesures de drop, le dernier coup.
const JB = 60 / 174, JBAR = 4 * JB;
const J_VOID = 2 * JBAR - JB, J_DROP = 2 * JBAR, J_END = J_DROP + 4 * JBAR;
const J_KICKS_UP = [0, 2 * JB, 4 * JB, 6 * JB];
const J_KICKS = [J_DROP, J_DROP + 2.5 * JB, J_DROP + JBAR, J_DROP + JBAR + 2.5 * JB,
	J_DROP + 2 * JBAR, J_DROP + 2 * JBAR + 2.5 * JB, J_DROP + 3 * JBAR, J_DROP + 3 * JBAR + 2.5 * JB, J_END];
const J_SNARES = [J_DROP + JB, J_DROP + 3 * JB, J_DROP + JBAR + JB, J_DROP + JBAR + 3 * JB,
	J_DROP + 2 * JBAR + JB, J_DROP + 2 * JBAR + 3 * JB, J_DROP + 3 * JBAR + JB, J_DROP + 3 * JBAR + 3 * JB];
const J_CMDS = [[0, 'sudo vjod --boot'], [2 * JB, 'mount /dev/caisson /mnt/basses'], [4 * JB, './basse --gain 11 --wobble'], [6 * JB, 'export BPM=174']];
const J_DROP_CMDS = ['./basse --wobble 1/8', './kick --punch max', './snare --crack', './vjod --drop --encore'];

export class IntroPainter {
	constructor(kit) {
		this.k = kit;
	}

	paint(c, style, t, W, H) {
		this.c = c;
		this.t = t;
		this.W = W;
		this.H = H;
		let w = W * 0.78;
		if (w / ASPECT > H * 0.58) w = H * 0.58 * ASPECT;
		this.w = w;
		this.h = w / ASPECT;
		this.cx = W / 2;
		this.cy = H / 2;
		// l'échelle de ce qui a été dessiné pour un écran 1920 × 1080
		this.u = Math.min(H / 1080, W / 1110);
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.globalAlpha = 1;
		c.globalCompositeOperation = 'source-over';
		c.fillStyle = BLACK;
		c.fillRect(0, 0, W, H);
		c.textBaseline = 'top';
		c.textAlign = 'left';
		c.save();
		switch (style) {
			case 'lame': this.lame(); break;
			case 'ruban': this.ruban(); break;
			case 'battement': this.battement(); break;
			case 'signal': this.signal(); break;
			case 'hacker': this.hacker(); break;
			case 'plateforme': this.plateforme(); break;
			case 'terminal': this.terminal(); break;
			default: this.drop();
		}
		c.restore();
	}

	// ------------------------------------------------------------ outils
	halo(x, y, r, s) {
		if (r <= 0 || s <= 0) return;
		const c = this.c;
		const g = c.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, red(s));
		g.addColorStop(0.35, red(s * 0.35));
		g.addColorStop(1, red(0));
		c.fillStyle = g;
		c.beginPath();
		c.arc(x, y, r, 0, Math.PI * 2);
		c.fill();
	}

	// Le logo centré sur (x, y), ou une tranche verticale (x0..x1 de l'image).
	logo(x, y, o = {}) {
		const {scale = 1, sx = 1, sy = 1, alpha = 1, x0 = 0, x1 = 1, bright = 1, tint = null, plus = false, band = null, image = null} = o;
		if (alpha <= 0) return;
		const {c, w, h, k} = this;
		c.save();
		if (band) {
			c.beginPath();
			c.rect(band.x, band.y, band.w, band.h);
			c.clip();
		}
		c.translate(x, y);
		c.scale(scale * sx, scale * sy);
		if (x0 > 0 || x1 < 1) {
			c.beginPath();
			c.rect(-w / 2 + x0 * w, -h / 2, (x1 - x0) * w, h);
			c.clip();
		}
		const img = image || (tint === 'cyan' ? k.cyan : tint === 'gold' ? k.gold : k.logo);
		c.globalCompositeOperation = plus ? 'lighter' : 'source-over';
		// Plus clair : le logo redessiné par-dessus en addition.
		const base = Math.min(1, bright);
		c.globalAlpha = clamp(alpha * base);
		c.drawImage(img, -w / 2, -h / 2, w, h);
		let extra = bright - 1;
		if (extra > 0) {
			c.globalCompositeOperation = 'lighter';
			while (extra > 0) {
				c.globalAlpha = clamp(alpha * Math.min(1, extra));
				c.drawImage(img, -w / 2, -h / 2, w, h);
				extra -= 1;
			}
		}
		c.restore();
	}

	// Un glitch horizontal : une bande du logo redessinée, décalée.
	glitchBand(bandH, shift) {
		const {c, W, cy, h} = this;
		const y = cy - h * 0.25 + rand() * h * 0.5;
		c.fillStyle = BLACK;
		c.fillRect(0, y, W, bandH);
		this.logo(this.cx + shift, cy, {band: {x: 0, y, w: W, h: bandH}});
	}

	// Beaucoup de caractères d'un coup : [glyphe, x, y, taille, atlas, alpha].
	glyphs(list) {
		const {c, k} = this;
		c.save();
		for (let i = 0; i < list.length; i++) {
			const [g, x, y, size, sheet, a] = list[i];
			if (a <= 0) continue;
			const s = size / k.glyphH;
			const dw = k.glyphW * s, dh = k.glyphH * s;
			c.globalAlpha = clamp(a);
			c.drawImage(sheet, g * k.glyphW, 0, k.glyphW, k.glyphH, x - dw / 2, y - dh / 2, dw, dh);
		}
		c.restore();
	}

	// Une ligne de texte du terminal ; renvoie sa largeur.
	text(s, x, y, size, color) {
		const c = this.c;
		c.font = `${size}px ${MONO}`;
		c.fillStyle = color;
		c.fillText(s, x, y);
		return c.measureText(s).width;
	}

	textWidth(s, size) {
		this.c.font = `${size}px ${MONO}`;
		return this.c.measureText(s).width;
	}

	snow(a) {
		if (a <= 0) return;
		const {c, k, W, H} = this;
		const img = k.snow[Math.floor(rand() * k.snow.length)];
		c.save();
		c.imageSmoothingEnabled = false;
		c.globalAlpha = clamp(a);
		c.drawImage(img, 0, 0, W, H);
		c.restore();
	}

	scan(a) {
		const {c, W, H, u} = this;
		c.fillStyle = `rgba(0,0,0,${clamp(a)})`;
		const step = Math.max(4, u * 6);
		for (let y = 0; y < H; y += step) c.fillRect(0, y, W, step / 2);
	}

	flash(a, color = '255,255,255') {
		if (a > 0) {
			this.c.fillStyle = `rgba(${color},${clamp(a)})`;
			this.c.fillRect(0, 0, this.W, this.H);
		}
	}

	flashBlack(a) {
		this.flash(a, '4,4,4');
	}

	// La vieille télé qui s'éteint : l'image écrasée en ligne, puis en point.
	crt(offY, offX) {
		const {c, cx, cy} = this;
		c.translate(cx, cy);
		c.scale(Math.max(0.002, 1 - 0.995 * offX), Math.max(0.004, 1 - offY));
		c.translate(-cx, -cy);
	}

	cellXY(p, sc = 1) {
		const {w, h, cx, cy, k} = this;
		const cw = w / k.cols, ch = h / k.rows;
		return [cx + (-w / 2 + (p.q + 0.5) * cw) * sc, cy + (-h / 2 + (p.r + 0.5) * ch) * sc];
	}

	// ------------------------------------------------------------ A, la lame
	lame() {
		const {c, t, w, h, cx, cy, u, W, k} = this;
		const hit = 1.05, dive = 2.45;
		const front = 0.09 + seg(t, 0.22, hit, ioc) * 0.82;
		const bladeOn = t < hit + 0.12 ? 1 - seg(t, hit - 0.05, hit + 0.12) : 0;
		const strike = t >= hit ? 1 - seg(t, hit, hit + 0.65, oc) : 0;
		const jolt = t >= hit ? Math.sin(Math.PI * seg(t, hit, hit + 0.28)) : 0;
		const glow = t >= hit ? (0.35 + 0.65 * strike) * (1 - seg(t, dive, dive + 0.3)) : 0;
		const intro = 0.93 + 0.07 * seg(t, 0.22, hit, oc), push = 1 + 0.07 * seg(t, hit, dive, io);
		const d = seg(t, dive, 3.05, ic);
		const scale = intro * push * (1 + 0.045 * jolt) * Math.pow(55, d);
		const tfx = (TRI.x - 0.5) * w, tfy = (TRI.y - 0.5) * h;
		const shx = -tfx * d, shy = -tfy * d;
		if (bladeOn > 0) this.halo(cx + (front - 0.5) * w * intro, cy, w * 0.45, 0.22 * bladeOn);
		const tpx = cx + tfx * intro * push + shx, tpy = cy + tfy * intro * push + shy;
		if (glow > 0) this.halo(tpx, tpy, w * (0.35 + 0.5 * (1 - strike)), 0.5 * glow);

		// Le logo révélé jusqu'au front de la lame, dans une image à part.
		const sc = k.scratch, sx = sc.getContext('2d');
		const iw = sc.width, ih = sc.height;
		sx.globalCompositeOperation = 'copy';
		sx.globalAlpha = 1;
		sx.drawImage(k.logo, 0, 0);
		sx.globalCompositeOperation = 'destination-in';
		const g = sx.createLinearGradient(0, 0, iw, 0);
		g.addColorStop(0, '#fff');
		g.addColorStop(Math.max(0, front - 0.035), '#fff');
		g.addColorStop(Math.min(1, front), 'rgba(255,255,255,0)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		sx.fillStyle = g;
		sx.fillRect(0, 0, iw, ih);
		sx.globalCompositeOperation = 'source-over';

		c.save();
		c.translate(cx + shx, cy + shy);
		c.translate(tfx, tfy);
		c.scale(scale, scale);
		c.translate(-tfx, -tfy);
		this.logo(0, 0, {bright: t < hit ? 0.8 : 1 + 0.55 * strike, image: sc});
		if (bladeOn > 0) {
			const bx = -w / 2 + front * w;
			const rx = bx - u * 14, ry = -h / 2 + h * 0.18, rw = u * 28, rh = h * 0.64;
			c.save();
			c.shadowColor = red(0.7 * bladeOn);
			c.shadowBlur = u * 36;
			c.fillStyle = red(0.7 * bladeOn);
			c.fillRect(rx - u * 6, ry - u * 6, rw + u * 12, rh + u * 12);
			c.restore();
			const bg = c.createLinearGradient(rx, 0, rx + rw, 0);
			bg.addColorStop(0, red(0));
			bg.addColorStop(0.3, red(0.67 * bladeOn));
			bg.addColorStop(0.5, white(bladeOn));
			bg.addColorStop(0.7, red(0.67 * bladeOn));
			bg.addColorStop(1, red(0));
			c.fillStyle = bg;
			c.fillRect(rx, ry, rw, rh);
		}
		c.restore();
		if (strike > 0) {
			const p = clamp(tpx / W);
			const sg = c.createLinearGradient(0, 0, W, 0);
			sg.addColorStop(0, red(0));
			sg.addColorStop(clamp(p - 0.3), red(0.54 * strike));
			sg.addColorStop(p, white(0.9 * strike));
			sg.addColorStop(clamp(p + 0.3), red(0.54 * strike));
			sg.addColorStop(1, red(0));
			c.fillStyle = sg;
			c.fillRect(0, tpy - 1.5 - 6 * strike, W, 3 + 12 * strike);
		}
		this.flashBlack(seg(t, 2.95, 3.25, ei));
	}

	// ------------------------------------------------------------ B, le ruban
	ruban() {
		const {c, t, w, h, cx, cy, u, W, H, k} = this;
		const knot = 1.2;
		const fly = seg(t, 0, knot, io);
		if (t < knot + 0.05) {
			const amp = H * 0.28 * (1 - fly) + h * 0.02, len = W * (1.4 - 0.75 * fly), thick = h * (0.16 + 0.1 * fly);
			const head = clamp(t / 0.7), alpha = 1 - seg(t, knot - 0.08, knot + 0.05);
			const x0 = cx - (1 - fly) * W * 0.25;
			this.halo(cx, cy, W * 0.4, 0.12 * fly);
			const n = 160;
			const phase = t * 6;
			for (let i = 0; i < n; i++) {
				const a = i / n, b = (i + 1) / n;
				if (a > head) break;
				const xa = x0 - len / 2 + a * len, xb = x0 - len / 2 + b * len;
				const ya = cy + amp * Math.sin(a * Math.PI * 3 + phase), yb = cy + amp * Math.sin(b * Math.PI * 3 + phase);
				const tw = Math.abs(Math.cos(a * Math.PI * 3 + phase * 1.3));
				const th = thick * (0.25 + 0.75 * tw);
				c.fillStyle = `hsla(357,92%,${40 + 30 * tw}%,${clamp(alpha)})`;
				c.beginPath();
				c.moveTo(xa, ya - th / 2);
				c.lineTo(xb + 0.5, yb - th / 2);
				c.lineTo(xb + 0.5, yb + th / 2);
				c.lineTo(xa, ya + th / 2);
				c.closePath();
				c.fill();
			}
		}
		if (t >= knot - 0.06) {
			const f = t >= knot ? 1 - seg(t, knot, knot + 0.5, oc) : 0;
			const pop = seg(t, knot - 0.06, knot + 0.35, back), out = seg(t, 2.65, 3.0, ic);
			this.halo(cx, cy, w * (0.6 + 0.3 * (1 - f)), 0.25 + 0.35 * f);
			const base = 1.15 - 0.15 * pop + 0.04 * seg(t, knot + 0.35, 2.65, io);
			const sx = base + 0.5 * out, sy = base * (1 - 0.985 * out);
			this.logo(cx, cy, {sx, sy, alpha: seg(t, knot - 0.06, knot + 0.1), bright: 1 + 0.8 * f + 2 * out});
			const s = seg(t, 1.65, 2.25, io);
			if (s > 0 && s < 1) {
				// un reflet qui traverse les lettres
				const sc = k.scratch, x = sc.getContext('2d');
				const iw = sc.width, ih = sc.height;
				x.globalCompositeOperation = 'copy';
				x.globalAlpha = 1;
				x.drawImage(k.logo, 0, 0);
				x.globalCompositeOperation = 'source-in';
				const gx = s * iw * 1.3 - iw * 0.15;
				const half = (u * 60) * iw / (w * sx);
				x.save();
				x.translate(gx, ih / 2);
				x.transform(1, 0, -0.4 * (iw / (w * sx)) / (ih / (h * sy)), 1, 0, 0);
				const g = x.createLinearGradient(-half, 0, half, 0);
				g.addColorStop(0, 'rgba(255,255,255,0)');
				g.addColorStop(0.5, 'rgba(255,220,220,0.35)');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				x.fillStyle = g;
				x.fillRect(-half, -ih, half * 2, ih * 2);
				x.restore();
				x.globalCompositeOperation = 'source-over';
				this.logo(cx, cy, {sx, sy, plus: true, image: sc});
			}
			if (out > 0) {
				const a = 0.9 * out * (1 - seg(t, 3.0, 3.25));
				const bw = w * 1.5 * (1 + out), bh = u * 4;
				c.fillStyle = white(a);
				c.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
			}
		}
		this.flashBlack(seg(t, 3.0, 3.3, ei));
	}

	// ------------------------------------------------------------ C, le battement
	battement() {
		const {c, t, w, h, cx, cy, u} = this;
		const full = 1.75;
		const tpx = cx + (TRI.x - 0.5) * w, tpy = cy + (TRI.y - 0.5) * h;
		if (t < 1) {
			const beat = Math.max(Math.exp(-Math.pow((t - 0.25) / 0.05, 2)), Math.exp(-Math.pow((t - 0.55) / 0.05, 2)) * 1.2);
			const move = seg(t, 0.75, 1, ioc);
			const ax = cx + (tpx - cx) * move, ay = cy + (tpy - cy) * move;
			const sz = h * (0.9 - 0.62 * move) * (1 + 0.18 * beat) * seg(t, 0, 0.18, oc);
			this.halo(ax, ay, sz * 2.2, 0.35 + 0.4 * beat);
			const tri = () => {
				c.beginPath();
				c.moveTo(ax - sz * 0.38, ay - sz * 0.5);
				c.lineTo(ax + sz * 0.55, ay);
				c.lineTo(ax - sz * 0.38, ay + sz * 0.5);
				c.closePath();
			};
			c.save();
			c.shadowColor = red(0.9);
			c.shadowBlur = u * 52 * (0.5 + beat);
			c.fillStyle = red(0.9);
			tri();
			c.fill();
			c.restore();
			c.fillStyle = red(1);
			tri();
			c.fill();
		}
		const f = t >= full ? 1 - seg(t, full, full + 0.6, oc) : 0;
		const shake = t >= full ? (1 - seg(t, full, full + 0.3)) * u * 8 : 0;
		const push = 1 + 0.06 * seg(t, full, 2.9, io), out = seg(t, 2.85, 3.3, ei);
		if (t >= full) this.halo(cx, cy, w * (0.55 + 0.3 * (1 - f)), 0.18 + 0.4 * f);
		const ox = shake * Math.sin(t * 90), oy = shake * Math.cos(t * 77);
		for (let i = 0; i < 4; i++) {
			const b = BEATS[i];
			if (t < b - 0.02) continue;
			const kk = seg(t, b - 0.02, b + 0.12, oc);
			this.logo(cx + ox, cy + oy, {
				scale: (1.7 - 0.7 * kk) * push * (1 + 0.25 * out),
				alpha: kk * (1 - out),
				x0: SLICES[i][0],
				x1: SLICES[i][1],
				bright: 1 + 0.9 * (1 - seg(t, b, b + 0.25)) + 0.6 * f
			});
		}
		if (t >= full && t < full + 0.1) this.flash(0.25 * (1 - seg(t, full, full + 0.1)));
	}

	// ------------------------------------------------------------ D, le signal
	signal() {
		const {c, t, w, cx, cy, u} = this;
		const lock = 0.98, off = 2.75;
		if (t < 0.05 || t > 3.12) {
			if (t > 3.0 && t < 3.12) this.halo(cx, cy, u * 30, 1);
			return;
		}
		const openX = seg(t, 0.05, 0.18, oc), openY = seg(t, 0.15, 0.32, oc);
		const offY = seg(t, off, 2.92, ic), offX = seg(t, 2.9, 3.08, ic);
		c.save();
		c.translate(cx, cy);
		c.scale(Math.max(0.002, openX * (1 - 0.995 * offX)), Math.max(0.004, openY * (1 - offY)));
		c.translate(-cx, -cy);
		if (t < lock) {
			this.snow(0.85);
			const kk = seg(t, 0.35, lock);
			const gl = [0.55, 0.72, 0.8].some((a) => t >= a && t < a + 0.05);
			this.logo(cx + (gl ? u * 40 : 0), cy, {alpha: 0.25 + 0.5 * kk});
			if (gl) this.logo(cx - u * 30, cy, {alpha: 0.5, tint: 'cyan'});
			this.flash(0.08);
		} else {
			const hk = 1 - seg(t, lock, lock + 0.6, oc);
			this.halo(cx, cy, w * (0.55 + 0.3 * (1 - hk)), 0.2 + 0.4 * hk);
			const gl = [1.6, 1.95, 2.05].some((a) => t >= a && t < a + 0.05);
			const split = u * (24 * hk + (gl ? 30 : 0));
			this.logo(cx - split, cy, {alpha: 0.55, tint: 'cyan', plus: true});
			this.logo(cx + split * 0.6, cy + (gl ? u * 6 : 0), {alpha: 0.4, tint: 'gold', plus: true});
			this.logo(cx, cy, {scale: 1 + 0.03 * hk, bright: 1 + 0.8 * hk});
			if (gl) this.glitchBand(u * 40, u * 30);
			this.snow(0.06 + 0.25 * hk);
			this.scan(0.18);
		}
		this.flash(offY);
		c.restore();
	}

	// ------------------------------------------------------------ E, le hacker
	rain(a) {
		if (a <= 0) return;
		const {t, u, W, H, k} = this;
		const list = [];
		for (let i = 0; i < k.rain.length; i++) {
			const col = k.rain[i];
			const y = ((t * col.s * u * 900 + col.o * H) % (H + u * 400)) - u * 200;
			for (let j = 0; j < 9; j++) {
				list.push([pick(i * 31 + j + Math.floor(t * 14)), col.x * W, y - j * u * 26, u * 22, k.red, a * (1 - j / 9)]);
			}
		}
		this.glyphs(list);
	}

	hacker() {
		const {c, t, w, h, cx, cy, u, W, H, k} = this;
		const drop = 1.6, off = 2.95;
		if (t > 3.3) return;
		const offY = seg(t, off, 3.12, ic), offX = seg(t, 3.1, 3.28, ic);
		c.save();
		this.crt(offY, offX);
		this.rain(t < drop ? 0.35 * seg(t, 0, 0.4) : 0.12 * (1 - seg(t, drop, drop + 0.5)) + 0.06);
		const termA = t < drop ? 1 : 1 - seg(t, drop, drop + 0.25);
		if (termA > 0) {
			const fs = u * 40;
			let y = H * 0.08;
			for (const [at, txt] of E_LINES) {
				if (t < at) continue;
				const n = Math.floor(clamp((t - at) / 0.16) * txt.length);
				const col = txt.startsWith('>') ? white(0.9 * termA) : red(0.95 * termA);
				const wd = this.text(txt.substring(0, n), W * 0.06, y, fs, col);
				if (n < txt.length && Math.floor(t * 10) % 2 === 0) {
					c.fillStyle = col;
					c.fillRect(W * 0.06 + wd + u * 4, y, u * 20, fs);
				}
				y += u * 58;
			}
		}
		if (t >= 0.95 && t < drop + 0.05) {
			// le logo qui se déchiffre, case par case
			const cw = w / k.cols, ch = h / k.rows;
			const prog = seg(t, 1.0, drop - 0.05);
			const list = [];
			for (const p of k.cells) {
				const [x, y] = this.cellXY(p);
				if (p.rnd < prog * 1.05) {
					c.fillStyle = red(0.95 * p.a);
					c.fillRect(x - cw * 0.4, y - ch * 0.45, cw * 0.8, ch * 0.9);
				} else if (rand() < 0.5) {
					list.push([pick(p.q * 7 + p.r * 13 + Math.floor(t * 30)), x, y, ch * 1.15, k.white, 0.55 * p.a]);
				}
			}
			this.glyphs(list);
		}
		if (t >= drop) {
			const hk = 1 - seg(t, drop, drop + 0.6, oc);
			this.halo(cx, cy, w * (0.55 + 0.3 * (1 - hk)), 0.18 + 0.4 * hk);
			const gl = [2.1, 2.18, 2.4].some((a) => t >= a && t < a + 0.045);
			const split = u * (26 * hk + (gl ? 34 : 0));
			this.logo(cx - split, cy, {alpha: 0.5, tint: 'cyan', plus: true});
			this.logo(cx + split * 0.6, cy + (gl ? u * 6 : 0), {alpha: 0.35, tint: 'gold', plus: true});
			this.logo(cx, cy, {scale: 1 + 0.03 * hk, bright: 1 + 0.8 * hk});
			if (gl) this.glitchBand(u * 46, u * 40);
			if (t >= drop + 0.15 && (Math.floor((t - drop) * 6) % 2 === 0 || t > drop + 0.8)) {
				const s = '[ ACCÈS AUTORISÉ ]';
				const n = Math.floor(seg(t, drop + 0.15, drop + 0.4) * s.length);
				const fs = u * 30;
				this.text(s.substring(0, n), cx - this.textWidth(s, fs) / 2, cy + h * 0.62 - fs / 2, fs, red(0.95));
			}
			this.scan(0.2);
			this.snow(0.04 + 0.2 * hk);
		}
		if (t >= drop && t < drop + 0.08) this.flash(0.3 * (1 - seg(t, drop, drop + 0.08)));
		this.flash(offY);
		c.restore();
	}

	// ------------------------------------------------------------ F, la plateforme
	plateforme() {
		const {c, t, w, h, cx, cy, u, W, H, k} = this;
		const hit = 1.25, dis = 2.4;
		const cw = w / k.cols, ch = h / k.rows;
		if (t < hit + 0.2) {
			this.halo(cx, cy, w * 0.7, 0.25 * seg(t, 0.3, hit));
			const list = [];
			for (const p of k.cells) {
				const kk = seg(t, 0.15 + p.delay, hit - 0.05, oc);
				if (kk <= 0) continue;
				const [tx, ty] = this.cellXY(p);
				const x = tx + p.sx * W * (1 - kk), y = ty + p.sy * H * (1 - kk);
				if (kk > 0.97) {
					c.fillStyle = red(p.a);
					c.fillRect(x - cw * 0.4, y - ch * 0.45, cw * 0.8, ch * 0.9);
				} else {
					// du blanc rosé au rouge à mesure que le caractère arrive
					const v = 90 + 120 * (1 - kk);
					const sheet = k.pinks[Math.min(3, Math.max(0, Math.round((v - 90) / 40)))];
					list.push([pick(p.seed + Math.floor(t * 24)), x, y, ch * 1.2, sheet, 0.35 + 0.6 * kk]);
				}
			}
			this.glyphs(list);
		}
		if (t >= hit) {
			const hk = 1 - seg(t, hit, hit + 0.7, oc), vis = seg(t, hit, hit + 0.18);
			const d = seg(t, dis, 2.95, ic);
			this.halo(cx, cy, w * (0.6 + 0.3 * (1 - hk)), (0.2 + 0.45 * hk) * (1 - d));
			if (d <= 0) {
				this.logo(cx - 18 * hk * u, cy, {alpha: 0.45 * vis, tint: 'cyan', plus: true});
				const sc = 1.04 - 0.04 * seg(t, hit, hit + 0.4, oc) + 0.035 * seg(t, hit + 0.4, dis, io);
				this.logo(cx, cy, {alpha: vis, scale: sc, bright: 1 + 0.9 * hk});
				const sl = seg(t, 1.7, 2.25, io);
				if (sl > 0 && sl < 1) {
					// la ligne de lecture qui balaie le logo
					const y = cy - h * 0.55 + sl * h * 1.1;
					const rx = cx - w * 0.55, ry = y - u * 30, rh = u * 60;
					const g = c.createLinearGradient(0, ry, 0, ry + rh);
					g.addColorStop(0, 'rgba(255,255,255,0)');
					g.addColorStop(0.5, 'rgba(255,230,230,0.5)');
					g.addColorStop(1, 'rgba(255,255,255,0)');
					c.fillStyle = g;
					c.fillRect(rx, ry, w * 1.1, rh);
					const list = [];
					for (let i = 0; i < 24; i++) list.push([pick(i + Math.floor(t * 30)), cx - w * 0.5 + i * w / 23, y - u * 22, ch * 1.2, k.white, 0.8]);
					this.glyphs(list);
				}
				if (t >= hit + 0.3) {
					const s = 'STREAM · LIVE · ON DEMAND';
					const n = Math.floor(seg(t, hit + 0.3, hit + 0.75) * s.length);
					const fs = u * 34;
					this.text(s.substring(0, n), cx - this.textWidth(s, fs) / 2, cy + h * 0.62 - fs / 2, fs, red(0.9 * seg(t, hit + 0.3, hit + 0.6)));
				}
			} else {
				// le logo qui se dissout en blocs
				const sc = 1.035 + 0.25 * d;
				const list = [];
				for (const p of k.cells) {
					const [x, y] = this.cellXY(p, sc);
					if (p.rnd < d * 1.1) {
						if (p.rnd > d * 1.1 - 0.12) {
							list.push([pick(p.seed + Math.floor(t * 30)), x + p.sx * W * 0.3 * d, y + p.sy * H * 0.3 * d, ch * 1.2, k.white, 0.7 * (1 - d)]);
						}
						continue;
					}
					c.fillStyle = red(p.a);
					c.fillRect(x - (cw * sc + 1) / 2, y - (ch * sc + 1) / 2, cw * sc + 1, ch * sc + 1);
				}
				this.glyphs(list);
			}
			this.scan(0.14 * (1 - d));
		}
		if (t >= hit && t < hit + 0.07) this.flash(0.35 * (1 - seg(t, hit, hit + 0.07)));
	}

	// ------------------------------------------------------------ ★, le drop
	pulse(hits, dec) {
		let p = 0;
		for (const b of hits) if (this.t >= b) p = Math.max(p, Math.exp(-(this.t - b) / dec));
		return p;
	}

	// Le logo qui tremble : vib pixels de secousse, séparé en couleurs par split.
	vibratingLogo({vib, scale, split, bright, alpha = 1}) {
		const {cx, cy} = this;
		const dx = (rand() * 2 - 1) * vib, dy = (rand() * 2 - 1) * vib * 0.45;
		this.logo(cx + dx - split, cy + dy, {scale, alpha: 0.55 * alpha, tint: 'cyan', plus: true});
		this.logo(cx + dx + split * 0.7, cy - dy, {scale, alpha: 0.35 * alpha, tint: 'gold', plus: true});
		this.logo(cx + dx, cy + dy, {scale, bright, alpha});
	}

	// Le terminal plein écran de la montée : les commandes tapées, leur sortie
	// qui défile dessous.
	typedTerminal({fs, alpha, lines}) {
		const {c, t, u, W, H} = this;
		const lh = fs * 1.3, x0 = W * 0.035;
		const fit = Math.floor(H * 0.96 / lh);
		const rows = [];
		for (const [at, cmd] of J_CMDS) {
			if (t < at) break;
			const n = Math.floor(seg(t, at, at + JB * 0.45) * cmd.length);
			rows.push([true, cmd.substring(0, n), t < at + JB * 0.5]);
			if (t >= at + JB * 0.5) {
				const kk = Math.min(40, Math.floor((t - at - JB * 0.5) * lines));
				for (let i = 0; i < kk; i++) rows.push([false, torrentLine(Math.floor(at * 100) + i, 4), false]);
			}
		}
		const a = Math.round(clamp(alpha) * 8) / 8;
		const first = Math.max(0, rows.length - fit);
		for (let i = first; i < rows.length; i++) {
			const [cmd, s, typing] = rows[i];
			const y = H * 0.02 + (i - first) * lh;
			if (cmd) {
				const w0 = this.text('$ ', x0, y, fs, red(a));
				const w1 = this.text(s, x0 + w0, y, fs, white(a));
				if (typing && Math.floor(t * 12) % 2 === 0) {
					c.fillStyle = white(a);
					c.fillRect(x0 + w0 + w1 + u * 3, y, fs * 0.55, fs);
				}
			} else {
				this.text(s, x0, y, fs, s.startsWith('[ OK ]') ? red(a * 0.9) : white(a * 0.55));
			}
		}
	}

	drop() {
		const {c, t, w, cx, cy, u, W, H} = this;
		if (t > J_END + 1) return;
		if (t >= J_VOID && t < J_DROP) {
			// le temps vide : la commande, seule
			const s = './vjod --drop';
			const fs = u * 48;
			const n = Math.floor(seg(t, J_VOID, J_VOID + JB * 0.55) * s.length);
			const x0 = cx - (this.textWidth('$ ', fs) + this.textWidth(s, fs)) / 2;
			const wa = this.text('$ ', x0, cy - fs / 2, fs, red(1));
			const ws = this.text(s.substring(0, n), x0 + wa, cy - fs / 2, fs, '#ffffff');
			if (Math.floor(t * 8) % 2 === 0) {
				c.fillStyle = '#ffffff';
				c.fillRect(x0 + wa + ws + u * 6, cy - fs / 2, u * 22, fs);
			}
			return;
		}
		const offY = seg(t, J_END + 0.6, J_END + 0.77, ic), offX = seg(t, J_END + 0.75, J_END + 0.93, ic);
		c.save();
		this.crt(offY, offX);
		if (t < J_VOID) {
			const kk = seg(t, 0, J_VOID);
			const kp = this.pulse(J_KICKS_UP, 0.2);
			this.vibratingLogo({vib: u * (2 + 14 * kk * kk + 10 * kp), scale: 0.9 + 0.04 * kp, split: u * (4 + 10 * kp), bright: 0.5 + 0.6 * kp, alpha: 0.18 + 0.25 * kk + 0.2 * kp});
			this.typedTerminal({fs: u * 26, alpha: 0.55 + 0.4 * kk, lines: 22 + 60 * kk});
		} else {
			const kp = this.pulse(J_KICKS, 0.16), sp = this.pulse(J_SNARES, 0.09);
			const bar = Math.min(3, Math.floor((t - J_DROP) / JBAR));
			const inBar = t - J_DROP - bar * JBAR;
			// la basse qui pulse en croches
			const wob = Math.abs(Math.sin(Math.PI * (t - J_DROP) / (JB / 2)));
			// le mur de lignes, déversé à chaque temps
			const beat = Math.floor((t - J_DROP) / JB);
			const fs = u * 20, lh = fs * 1.25;
			const fit = Math.floor(H / lh) + 1;
			const count = beat * 6 + Math.floor(seg(inBar % JB, 0, JB * 0.3) * 6) + 30;
			const first = Math.max(0, count - fit);
			const aRed = Math.round((0.16 + 0.3 * kp) * 8) / 8, aWhite = Math.round((0.1 + 0.18 * kp) * 8) / 8;
			for (let i = first; i < count; i++) {
				const isRed = i % 5 === 0 || sp > 0.4;
				this.text(torrentLine(i, 11), W * 0.035, (i - first) * lh, fs, isRed ? red(aRed) : white(aWhite));
			}
			this.halo(cx, cy, w * (0.6 + 0.3 * kp), 0.22 + 0.5 * kp);
			const end = t >= J_END;
			const roll = bar === 3 && inBar > 3 * JB;
			this.vibratingLogo({
				vib: u * (end ? 4 : 6 + 22 * wob + 26 * kp + (roll ? 30 : 0)),
				scale: end ? 1.12 - 0.12 * seg(t, J_END, J_END + 0.2, oc) : 1 + 0.07 * kp,
				split: u * (8 + 30 * kp + 40 * sp),
				bright: 1 + 1.2 * kp
			});
			if (sp > 0.35) this.glitchBand(u * (40 + 30 * rand()), u * (60 * rand() - 30));
			// la commande de cette mesure, en bas
			const by = H * 0.84, tfs = u * 34;
			c.fillStyle = 'rgba(0,0,0,0.7)';
			c.fillRect(0, by, W, u * 64);
			if (end) {
				this.text('▶ lecture', W * 0.035, by + u * 14, tfs, '#ffffff');
			} else {
				const cmd = J_DROP_CMDS[bar];
				const n = Math.floor(seg(inBar, 0, JB * 0.5) * cmd.length);
				const w0 = this.text('$ ', W * 0.035, by + u * 14, tfs, red(1));
				this.text(cmd.substring(0, n), W * 0.035 + w0, by + u * 14, tfs, '#ffffff');
			}
			const meter = `174 BPM · ${'█'.repeat(beat % 16 + 1)}`;
			this.text(meter, W * 0.965 - this.textWidth(meter, tfs), by + u * 14, tfs, red(0.6 + 0.4 * kp));
			this.scan(0.15);
			this.snow(0.03 * kp);
		}
		if (t >= J_DROP) this.flash(0.4 * this.pulse([J_DROP, J_END], 0.05));
		this.flash(offY);
		c.restore();
	}

	// ------------------------------------------------------------ G, les lignes de commande
	terminal() {
		const {c, t, w, h, cx, cy, u, W, H, k} = this;
		const play = 2.02, off = 2.92;
		if (t > 3.26) return;
		const offY = seg(t, off, 3.08, ic), offX = seg(t, 3.06, 3.24, ic);
		c.save();
		this.crt(offY, offX);
		const fs = u * 30, lh = u * 40, x0 = W * 0.05;
		const termA = t < play ? 1 : 1 - seg(t, play, play + 0.3);
		let y = H * 0.06;
		const wh = white(termA);
		if (termA > 0) {
			for (const [at, end, a, b, kind] of G_TERM) {
				if (t < at) continue;
				if (kind === 'cmd') {
					const n = Math.floor(seg(t, at, end) * b.length);
					const w0 = this.text(a, x0, y, fs, red(termA));
					const w1 = this.text(b.substring(0, n), x0 + w0, y, fs, wh);
					if (t < end + 0.05 && Math.floor(t * 12) % 2 === 0) {
						c.fillStyle = wh;
						c.fillRect(x0 + w0 + w1 + u * 4, y, u * 18, fs);
					}
				} else if (kind === 'out') {
					this.text(a, x0, y, fs, white(0.85 * termA));
				} else if (kind === 'dim') {
					this.text(a, x0, y, fs, white(0.45 * termA));
				} else if (kind === 'bar') {
					const kk = seg(t, at, end);
					const n = 30;
					const f = Math.round(kk * n);
					const cell = fs * 0.6;
					const w0 = this.text('[', x0, y, fs, red(termA));
					for (let i = 0; i < n; i++) {
						c.fillStyle = i < f ? red(termA) : red(0.3 * termA);
						c.fillRect(x0 + w0 + i * cell, y + fs * 0.1, cell * 0.9, fs * 0.8);
					}
					const ok = Math.round(kk * 30);
					this.text(`]${String(Math.round(kk * 100)).padStart(4)}%  ${ok}/30 sources${kk >= 1 ? '  OK' : ''}`, x0 + w0 + n * cell, y, fs, red(termA));
				} else if (kind === 'hex') {
					const lines = Math.floor(seg(t, at, 1.36) * 2.99);
					for (let i = 0; i < lines; i++) {
						this.text(`0x${(0x7f3a00 + i * 16).toString(16)}  ${hexLine(i + Math.floor(t * 20))}`, x0, y, fs, white(0.35 * termA));
						if (i < lines - 1) y += lh;
					}
				}
				y += lh;
			}
		}
		// le logo imprimé en caractères, ligne par ligne
		if (t >= 1.36 && t < play + 0.12) {
			const rows = k.asciiRows, cols = k.asciiCols;
			const prog = seg(t, 1.36, 1.86) * rows;
			const shown = Math.floor(prog);
			const cwid = w / cols, rh = h * 0.62 / rows;
			const top = cy - h * 0.18;
			const fade = t >= play ? 1 - seg(t, play, play + 0.12) : 1;
			for (let r = 0; r < Math.min(shown + 1, rows); r++) {
				const upto = r === shown ? Math.floor((prog - r) * cols) : cols;
				for (let q = 0; q < upto; q++) {
					const lv = k.ascii[r * cols + q];
					if (lv <= 0) continue;
					c.fillStyle = red(0.95 * fade * lv);
					c.fillRect(cx - w / 2 + q * cwid, top + r * rh, cwid * 0.92, rh * 0.9);
				}
			}
		}
		const py = H * 0.86;
		if (t >= 1.88 && t < play) {
			const a = 'root@seedbox:~# ', b = './vjod --play';
			const n = Math.floor(seg(t, 1.88, 2.0) * b.length);
			const w0 = this.text(a, x0, py, fs, red(1));
			this.text(b.substring(0, n), x0 + w0, py, fs, '#ffffff');
		}
		if (t >= play) {
			const hk = 1 - seg(t, play, play + 0.6, oc);
			this.halo(cx, cy, w * (0.55 + 0.3 * (1 - hk)), 0.2 + 0.45 * hk);
			const gl = [2.45, 2.52].some((a) => t >= a && t < a + 0.04);
			const split = u * (24 * hk + (gl ? 30 : 0));
			this.logo(cx - split, cy, {alpha: 0.5, tint: 'cyan', plus: true});
			this.logo(cx, cy, {scale: 1.05 - 0.05 * seg(t, play, play + 0.35, oc) + 0.03 * seg(t, play + 0.35, off, io), bright: 1 + 0.9 * hk});
			if (gl) this.glitchBand(u * 44, u * 36);
			const w0 = this.text('▶ lecture ', x0, py, fs, red(1));
			if (Math.floor(t * 4) % 2 === 0) {
				c.fillStyle = red(1);
				c.fillRect(x0 + w0, py, u * 18, fs);
			}
			this.scan(0.16);
		}
		if (t >= play && t < play + 0.07) this.flash(0.35 * (1 - seg(t, play, play + 0.07)));
		this.flash(offY);
		c.restore();
	}
}
