import AccountRepository from './AccountRepository'
import PositionRepository from './PositionRepository'
import PriceHistoryRepository from './PriceHistoryRepository'
import TriggerRepository from './TriggerRepository'

export interface EntityManagerArgs {
	repositories: RepositoriesByName
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

	constructor(args?: EntityManagerArgs) {
		const {
			repositories = {
				account: new AccountRepository(),
				position: new PositionRepository(),
				trigger: new TriggerRepository(),
				priceHistory: new PriceHistoryRepository()
			}
		} = args || {}
		this.repositories = repositories
	}

	public getRepository<T extends keyof RepositoriesByName>(repositoryName: T): RepositoriesByName[T] {
		return this.repositories[repositoryName]
	}
}
