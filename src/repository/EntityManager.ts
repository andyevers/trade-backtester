import AccountRepository from './AccountRepository'
import EventBus from './EventBus'
import PositionRepository from './PositionRepository'
import PriceHistoryRepository from './PriceHistoryRepository'
import TriggerRepository from './TriggerRepository'

export interface EntityManagerArgs {
	eventBus?: EventBus
	repositories?: RepositoriesByName
}

export type RepositoriesByName = {
	position: PositionRepository
	trigger: TriggerRepository
	account: AccountRepository
	priceHistory: PriceHistoryRepository
}

export default class EntityManager {
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
	}

	public getRepository<T extends keyof RepositoriesByName>(repositoryName: T): RepositoriesByName[T] {
		return this.repositories[repositoryName]
	}
}
