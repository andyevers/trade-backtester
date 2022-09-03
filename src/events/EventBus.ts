export default class EventBus<E extends Record<string, Record<string, any>>> {
	private readonly events: {
		[K in keyof E]?: {
			[eventId: string]: (data: E[K]) => void
		}
	} = {}

	public dispatch<T extends keyof E>(eType: T, data: E[T]) {
		for (const eventId in this.events[eType]) {
			;(this.events[eType] as any)[eventId](data)
		}
	}

	public on<T extends keyof E>(eType: T, id: string, callback: (data: E[T]) => void) {
		if (!this.events[eType]) this.events[eType] = {}
		const events = this.events[eType] as any
		if (events[id]) {
			throw new Error(`${id} is already registered for ${eType.toString()}`)
		}
		events[id] = callback
	}

	public off<T extends keyof E>(eType: T, id: string) {
		delete (this.events[eType] || ({} as any))[id]
	}
}
