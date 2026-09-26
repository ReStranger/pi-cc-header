import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	pick,
	stateFromConfig,
	colorCell,
	logoCellColor,
	piLogoRgb,
	gradientLevel,
	scanOsc4,
	shadesFromRgb,
	accentOpenToRgb,
	themeAccentShades,
	formatCwd,
	buildRuntimePaths,
	MAX_SLOGAN_LENGTH,
	configWritesEnabled,
	collectSkillNames,
} from "../extensions/pi-cc-header.ts";

// ── pick ──
describe("pick", () => {
	it("returns val when guard passes", () => {
		assert.equal(
			pick(42, (v) => typeof v === "number", 0),
			42,
		);
	});
	it("returns fallback when guard fails", () => {
		assert.equal(
			pick("hi", (v) => typeof v === "number", 99),
			99,
		);
	});
	it("handles boolean guard", () => {
		assert.equal(
			pick(true, (v) => typeof v === "boolean", "nope"),
			true,
		);
	});
	it("rejects mismatched truthy types", () => {
		assert.equal(
			pick(1, (v) => typeof v === "string", "fallback"),
			"fallback",
		);
	});
});

// ── stateFromConfig ──
describe("stateFromConfig", () => {
	it("returns defaults for empty config", () => {
		const s = stateFromConfig({});
		assert.equal(s.logoColorKey, "c");
		assert.equal(s.versionColored, 1);
		assert.equal(s.gradientOn, true);
		assert.equal(s.stripeEnabled, true);
	});

	it("reads valid color key", () => {
		const s = stateFromConfig({ color: "a" });
		assert.equal(s.logoColorKey, "a");
	});

	it("rejects invalid color key (falls back)", () => {
		const s = stateFromConfig({ color: "z" });
		assert.equal(s.logoColorKey, "c");
	});

	it("reads versionColored", () => {
		const s = stateFromConfig({ ver: 2 });
		assert.equal(s.versionColored, 2);
	});

	it("rejects non-number ver", () => {
		const s = stateFromConfig({ ver: "2" });
		assert.equal(s.versionColored, 1);
	});

	it("reads speed within range", () => {
		const s = stateFromConfig({ speed: 100 });
		assert.equal(s.logoInterval, 100);
	});

	it("rejects invalid speed (falls back)", () => {
		const s = stateFromConfig({ speed: 30 });
		assert.equal(s.logoInterval, 50);
	});

	it("reads slogan", () => {
		const s = stateFromConfig({ slogan: "hello world" });
		assert.equal(s.slogan, "hello world");
		assert.equal(s.sloganOn, true);
	});

	it("rejects overlong slogan (falls back to default)", () => {
		const overlong = "x".repeat(MAX_SLOGAN_LENGTH + 1);
		const s = stateFromConfig({ slogan: overlong });
		assert.equal(s.slogan, "Code something that makes you proud");
	});

	it("color key pi: logo RGB + theme accent", () => {
		assert.equal(stateFromConfig({ color: "pi" }).logoColorKey, "pi");
	});
});

describe("configWritesEnabled", () => {
	it("returns false when readOnlyConfig is enabled", () => {
		assert.equal(
			configWritesEnabled({ ccHeader: { readOnlyConfig: true } }),
			false,
		);
	});

	it("ignores non-object ccHeader values", () => {
		assert.equal(configWritesEnabled({ ccHeader: true as any }), true);
		assert.equal(configWritesEnabled({ ccHeader: [] as any }), true);
	});

	it("returns true by default", () => {
		assert.equal(configWritesEnabled({ ccHeader: {} }), true);
		assert.equal(configWritesEnabled({}), true);
		assert.equal(configWritesEnabled(null), true);
	});
});

// ── colorCell ──
describe("colorCell", () => {
	it("renders cyan cell", () => {
		const c = colorCell("cyan");
		assert.ok(c.includes("36m"));
		assert.ok(c.includes("██"));
	});

	it("renders logo cell in default (clawd) color", () => {
		const c = colorCell("logo");
		assert.ok(c.includes("38;2;251;73;52"));
	});

	it("renders panel default", () => {
		assert.equal(colorCell("panel"), "  ");
	});

	it("renders white cell", () => {
		assert.equal(colorCell("white"), "\x1b[39m██");
	});

	it("renders gradient l1 from default color map", () => {
		const c = colorCell("l1");
		assert.ok(c.includes("██"));
		assert.ok(c.includes("38;2;"));
	});
});

// ── logoCellColor ──
describe("logoCellColor", () => {
	const stillFrame = {
		phase: 6,
		active: "none" as const,
		ax: 0,
		ay: 0,
		flash: false,
		white: false,
	};

	it("returns panel for empty area (1,1)", () => {
		assert.equal(logoCellColor(stillFrame, 1, 1), "panel");
	});

	it("returns logo for white cell on Pi shape", () => {
		const c = logoCellColor(stillFrame, 5, 3); // (3,5) → WHITE_CELLS
		assert.ok(c.startsWith("l") || c === "logo");
	});

	it("returns flash for flash frame", () => {
		const flashFrame = { ...stillFrame, flash: true, white: false };
		assert.equal(logoCellColor(flashFrame, 6, 3), "flash");
	});
});

// ── piLogoRgb (/hc pi: P5-раскладка финала анимации, key `${y},${x}`) ──
describe("piLogoRgb", () => {
	it("maps Pi cells to animation colors", () => {
		assert.equal(piLogoRgb(3, 2), "cyan");
		assert.equal(piLogoRgb(4, 4), "cyan");
		assert.equal(piLogoRgb(4, 2), "red");
		assert.equal(piLogoRgb(6, 2), "red");
		assert.equal(piLogoRgb(5, 5), "green");
		assert.equal(piLogoRgb(6, 5), "green");
	});

	it("covers all 10 Pi cells, panel elsewhere", () => {
		const piCells: [number, number][] = [
			[3, 2],
			[3, 3],
			[3, 4],
			[4, 2],
			[4, 4],
			[5, 2],
			[5, 3],
			[5, 5],
			[6, 2],
			[6, 5],
		];
		for (const [y, x] of piCells) assert.notEqual(piLogoRgb(y, x), "panel");
		assert.equal(piLogoRgb(1, 1), "panel");
	});
});

// ── shadesFromRgb / parseOsc4Response (база градиента /hc pi из палитры терминала) ──
describe("shadesFromRgb", () => {
	it("keeps level 0 equal to the base color", () => {
		assert.equal(shadesFromRgb([122, 170, 255])[0], "38;2;122;170;255");
	});

	it("darkens monotonically across 4 levels", () => {
		const shades = shadesFromRgb([122, 170, 255]);
		assert.equal(shades.length, 4);
		const parse = (s: string) =>
			s.match(/38;2;(\d+);(\d+);(\d+)/)!.slice(1).map(Number);
		const levels = shades.map(parse);
		for (let i = 1; i < levels.length; i++) {
			for (let c = 0; c < 3; c++) {
				assert.ok(
					levels[i][c] <= levels[i - 1][c],
					`${shades[i]} should not be brighter than ${shades[i - 1]}`,
				);
			}
		}
	});
});

// ── scanOsc4 (чанки ввода: вырезаем ответы OSC 4, не теряя клавиши) ──
describe("scanOsc4", () => {
	const cyan = "\x1b]4;6;rgb:7a7a/aaaa/ffff\x07";

	it("parses 16-bit channels with BEL terminator", () => {
		assert.deepEqual(scanOsc4(cyan, "").found, [
			{ index: 6, rgb: [122, 170, 255] },
		]);
	});

	it("parses 8-bit channels with ST terminator", () => {
		assert.deepEqual(scanOsc4("\x1b]4;1;rgb:f2/5c/5c\x1b\\", "").found, [
			{ index: 1, rgb: [242, 92, 92] },
		]);
	});

	it("ignores OSC replies of other kinds", () => {
		const scan = scanOsc4("\x1b]11;rgb:1c1c/1c1c/1c1c\x07", "");
		assert.equal(scan.found.length, 0);
		assert.equal(scan.rest, "\x1b]11;rgb:1c1c/1c1c/1c1c\x07");
	});

	it("extracts response and swallows the chunk", () => {
		const scan = scanOsc4(cyan, "");
		assert.equal(scan.rest, "");
		assert.equal(scan.carry, "");
	});

	it("keeps user keystrokes that share the chunk", () => {
		const scan = scanOsc4(`${cyan}abc`, "");
		assert.equal(scan.found.length, 1);
		assert.equal(scan.rest, "abc");
	});

	it("holds a partial response until the next chunk", () => {
		const head = scanOsc4("\x1b]4;6;rgb:7a7a/aa", "");
		assert.equal(head.found.length, 0);
		assert.equal(head.carry, "\x1b]4;6;rgb:7a7a/aa");
		assert.equal(head.rest, "");
		const tail = scanOsc4("aa/ffff\x07", head.carry);
		assert.deepEqual(tail.found, [{ index: 6, rgb: [122, 170, 255] }]);
		assert.equal(tail.carry, "");
	});

	it("passes unrelated input through untouched", () => {
		const scan = scanOsc4("\x1b[A", "");
		assert.equal(scan.found.length, 0);
		assert.equal(scan.rest, "\x1b[A");
	});

	it("does not hold a complete response as carry", () => {
		const scan = scanOsc4(`${cyan}\x1b[1;5A`, "");
		assert.equal(scan.found.length, 1);
		assert.equal(scan.carry, "");
		assert.equal(scan.rest, "\x1b[1;5A");
	});
});

// ── gradientLevel (единое правило строк для GMAP/RGB_GMAP) ──
describe("gradientLevel", () => {
	it("maps rows to 4 shade levels", () => {
		assert.equal(gradientLevel(1), 0);
		assert.equal(gradientLevel(3), 0);
		assert.equal(gradientLevel(4), 1);
		assert.equal(gradientLevel(5), 2);
		assert.equal(gradientLevel(6), 3);
		assert.equal(gradientLevel(7), 3);
	});
});

// ── accentOpenToRgb / themeAccentShades (/hc pi + /hm: градиент из акцента темы) ──
describe("themeAccentShades", () => {
	it("parses truecolor open code", () => {
		assert.deepEqual(accentOpenToRgb("\x1b[38;2;100;150;200m"), [100, 150, 200]);
	});

	it("rejects non-truecolor and garbage", () => {
		assert.equal(accentOpenToRgb("\x1b[38;5;129m"), null);
		assert.equal(accentOpenToRgb("\x1b[39m"), null);
		assert.equal(accentOpenToRgb(""), null);
		assert.equal(accentOpenToRgb("\x1b[38;2;999;0;0m"), null);
	});

	it("builds 4 shades from theme accent", () => {
		const shades = themeAccentShades({
			getFgAnsi: () => "\x1b[38;2;100;150;200m",
		});
		assert.ok(shades !== null && shades.length === 4);
		assert.equal(shades[0], "38;2;100;150;200");
		// ×0.6 на самом тёмном уровне: 60;90;120
		assert.equal(shades[3], "38;2;60;90;120");
	});

	it("falls back to null without truecolor accent", () => {
		assert.equal(themeAccentShades({}), null);
		assert.equal(
			themeAccentShades({ getFgAnsi: () => "\x1b[38;5;129m" }),
			null,
		);
		assert.equal(
			themeAccentShades({
				getFgAnsi: () => {
					throw new Error("Unknown theme color");
				},
			}),
			null,
		);
	});
});

// ── buildRuntimePaths ──
describe("buildRuntimePaths", () => {
	it("builds settings and resource paths from custom agentDir", () => {
		const paths = buildRuntimePaths("/tmp/custom-agent");
		assert.equal(paths.settingsPath, "/tmp/custom-agent/settings.json");
		assert.equal(paths.npmRoot, "/tmp/custom-agent/npm/node_modules");
		assert.equal(paths.globalSkillsDir, "/tmp/custom-agent/skills");
		assert.equal(paths.globalAgentsPath, "/tmp/custom-agent/AGENTS.md");
	});

	it("builds project-local paths from configurable config dir name", () => {
		const paths = buildRuntimePaths(
			"/tmp/custom-agent",
			"/work/repo",
			".config-pi",
		);
		assert.equal(paths.projectSkillsDir, "/work/repo/.config-pi/skills");
		assert.equal(paths.projectAgentsPath, "/work/repo/.config-pi/AGENTS.md");
	});
});

// ── formatCwd ──
describe("formatCwd", () => {
	const home = homedir();

	if (home) {
		it("abbreviates home directory", () => {
			const cwd = join(home, "projects", "test");
			assert.equal(formatCwd(cwd), `~${cwd.slice(home.length)}`);
		});
	}

	it("returns path unchanged when not under home", () => {
		const result = formatCwd("/tmp/somewhere");
		assert.equal(result, "/tmp/somewhere");
	});
});

// ── collectSkillNames ──
describe("collectSkillNames", () => {
	const makeRoot = () => mkdtempSync(join(tmpdir(), "cch-skills-"));

	it("counts skill dirs containing SKILL.md", () => {
		const root = makeRoot();
		try {
			mkdirSync(join(root, "alpha"));
			writeFileSync(join(root, "alpha", "SKILL.md"), "---\nname: alpha\n---\n");
			mkdirSync(join(root, "beta"));
			writeFileSync(join(root, "beta", "SKILL.md"), "---\nname: beta\n---\n");
			const names = new Set<string>();
			collectSkillNames(root, names, 0);
			assert.deepEqual([...names].sort(), ["alpha", "beta"]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("recurses into grouping dirs without SKILL.md", () => {
		const root = makeRoot();
		try {
			mkdirSync(join(root, "group", "alpha"), { recursive: true });
			writeFileSync(
				join(root, "group", "alpha", "SKILL.md"),
				"---\nname: alpha\n---\n",
			);
			mkdirSync(join(root, "group", "beta"), { recursive: true });
			writeFileSync(
				join(root, "group", "beta", "SKILL.md"),
				"---\nname: beta\n---\n",
			);
			const names = new Set<string>();
			collectSkillNames(root, names, 0);
			assert.deepEqual([...names].sort(), ["alpha", "beta"]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("ignores dirs without SKILL.md and md without frontmatter", () => {
		const root = makeRoot();
		try {
			mkdirSync(join(root, "empty"));
			writeFileSync(join(root, "README.md"), "# readme\n");
			writeFileSync(join(root, "notes.md"), "no frontmatter\n");
			const names = new Set<string>();
			collectSkillNames(root, names, 0);
			assert.deepEqual([...names], []);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("counts md with frontmatter, including README.md", () => {
		const root = makeRoot();
		try {
			writeFileSync(join(root, "tips.md"), "---\nname: tips\n---\nbody\n");
			writeFileSync(join(root, "README.md"), "---\nname: readme-skill\n---\n");
			const names = new Set<string>();
			collectSkillNames(root, names, 0);
			assert.deepEqual([...names].sort(), ["README.md", "tips.md"]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("bounds recursion depth", () => {
		const root = makeRoot();
		try {
			let p = root;
			for (let i = 0; i < 10; i++) {
				p = join(p, `d${i}`);
				mkdirSync(p);
			}
			writeFileSync(join(p, "SKILL.md"), "---\nname: deep\n---\n");
			const names = new Set<string>();
			collectSkillNames(root, names, 0);
			assert.equal(names.size, 0); // 超出深度上限，最深 skill 不可达
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
