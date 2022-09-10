import AccountRepository from './AccountRepository'
import { EventBus } from '../events'
import PositionRepository from './PositionRepository'
import PriceHistoryRepository from './PriceHistoryRepository'
import TriggerRepository from './TriggerRepository'
import { RepositoryEvents } from './Repository'

export interface EntityManagerArgs {
	eventBus?: EventBus<RepositoryEvents>
	repositories?: RepositoriesByName
}

export type RepositoriesByName = {
	position: PositionRepository
	trigger: TriggerRepository
	account: AccountRepository
	priceHistory: PriceHistoryRepository
}

export default class EntityManager {
	private readonly eventBus: EventBus<RepositoryEvents>
	private readonly repositories: {
		[K in keyof RepositoriesByName]: RepositoriesByName[K]
	}

	constructor(args: EntityManagerArgs = {}) {
		const {
			eventBus = new EventBus(),
			repositories = {
				account: new AccountRepository({ eventBus }),
				position: new PositionRepository({ eventBus }),
				trigger: new TriggerRepository({ eventBus }),
				priceHistory: new PriceHistoryRepository({ eventBus })
			}
		} = args
		this.repositories = repositories
		this.eventBus = eventBus
	}

	public getRepository<T extends keyof RepositoriesByName>(repositoryName: T): RepositoriesByName[T] {
		return this.repositories[repositoryName]
	}

	public on<T extends keyof RepositoryEvents>(
		eType: T,
		id: string,
		callback: (data: RepositoryEvents[T]) => void
	) {
		this.eventBus.on(eType, id, callback)
	}

	public off<T extends keyof RepositoryEvents>(eType: T, id: string) {
		this.eventBus.off(eType, id)
	}
}
