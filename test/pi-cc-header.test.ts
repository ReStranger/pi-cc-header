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
