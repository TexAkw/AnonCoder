import entitiesCategories from './entities-categories.json' with { type: 'json' }
import { GetEntitiesCategoriesResponse } from '../_shared/types/api.ts'

export function entitiesCategoriesHandler(): GetEntitiesCategoriesResponse {
  return {
    entitiesCategories,
  }
}
