declare module "@earendil-works/pi-tui" {
	export function truncateToWidth(
		text: string,
		width: number,
		ellipsis: string,
	): string;
	export function visibleWidth(text: string): number;

	export interface Component {
		render(width: number): string[];
		invalidate(): void;
		dispose(): void;
	}

	export type TuiInputListenerResult = {
		/** data полностью поглощён — components его не увидят */
		consume?: boolean;
		/** data переписано (например, вырезан OSC-ответ терминала) */
		data?: string;
	} | undefined;
	export type TuiInputListener = (data: string) => TuiInputListenerResult;

	export interface TUI {
		requestRender(): void;
		/** Перехват ввода: ответы OSC 4 не должны попадать в компоненты (pi-tui) */
		addInputListener?(listener: TuiInputListener): () => void;
		/** Прямая запись в терминал для OSC-запросов палитры */
		terminal?: { write(data: string): void };
	}
}
