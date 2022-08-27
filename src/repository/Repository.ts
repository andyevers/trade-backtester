export interface Entity {
	id: number
}

export default abstract class Repository<T extends Entity> {
	protected readonly entities: Set<T> = new Set()
	protected readonly entitiesById: { [id: number]: T } = {}

	private index = 0

	private getNextIndex(): number {
		this.index++
		return this.index
	}

	public getAll(): T[] {
		return Array.from(this.entities)
	}

	public getAllAsSet(): Set<T> {
		return this.entities
	}

	public get(id: number): T | null {
		return this.entitiesById[id] || null
	}

	public create(entity: Omit<T, 'id'>): T {
		const id = this.getNextIndex()
		;(entity as T).id = id
		this.entities.add(entity as T)
		this.entitiesById[id] = entity as T
		return entity as T
	}

	public import(entity: T): T {
		if (this.entitiesById[entity.id]) {
			throw new Error(
				`Entity with id ${entity.id} already exists in repository ${this.constructor.name}`
			)
		}
		const id = entity.id + 1
		this.entities.add(entity as T)
		this.entitiesById[id] = entity as T
		return entity
	}

	public remove(id: number): void {
		this.entities.delete(this.entitiesById[id])
		delete this.entitiesById[id]
	}

	public update(id: number, params: Omit<Partial<T> | T, 'id'>): T | null {
		const entity = this.entitiesById[id] || null
		if (!entity) return null
		for (const key in params) {
			if (key === 'id') continue
			entity[key as keyof T] = params[key as keyof typeof params] as any
		}
		return entity
	}
}
