import { EntityManager } from '../repository'
import AccountService from './AccountService'
import PositionService from './PositionService'
import TriggerService from './TriggerService'

export interface ServiceManagerArgs {
	entityManager: EntityManager
	services?: {
		account: AccountService
		trigger: TriggerService
		position: PositionService
	}
}

export type ServicesByName = {
	account: AccountService
	trigger: TriggerService
	position: PositionService
}

export default class ServiceManager {
	private readonly services: {
		[K in keyof ServicesByName]: ServicesByName[K]
	}

	constructor(args: ServiceManagerArgs) {
		const { entityManager, services } = args
		const positionService = services?.position || new PositionService({ entityManager })
		const accountService = services?.account || new AccountService({ entityManager, positionService })
		const triggerService = services?.trigger || new TriggerService({ entityManager, accountService })
		this.services = {
			account: accountService,
			trigger: triggerService,
			position: positionService
		}
	}

	public getService<T extends keyof ServicesByName>(serviceName: T): ServicesByName[T] {
		return this.services[serviceName]
	}
}
