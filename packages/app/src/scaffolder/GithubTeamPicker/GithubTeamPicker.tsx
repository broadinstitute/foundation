import {
    type EntityFilterQuery,
    CATALOG_FILTER_EXISTS,
  } from '@backstage/catalog-client';
  import {
    Entity,
    parseEntityRef,
    stringifyEntityRef,
  } from '@backstage/catalog-model';
  import { useApi } from '@backstage/core-plugin-api';
  import {
    catalogApiRef,
    humanizeEntityRef,
  } from '@backstage/plugin-catalog-react';
  import { TextField } from '@material-ui/core';
  import FormControl from '@material-ui/core/FormControl';
  import Autocomplete, {
    AutocompleteChangeReason,
  } from '@material-ui/lab/Autocomplete';
  import React, { useCallback, useEffect } from 'react';
  import useAsync from 'react-use/lib/useAsync';
  import {
    GithubTeamPickerFilterQueryValue,
    GithubTeamPickerProps,
    GithubTeamPickerUiOptions,
    GithubTeamPickerFilterQuery,
  } from './schema';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension} from '@backstage/plugin-scaffolder-react';
  
export { GithubTeamTeamPickerSchema } from './schema';

export const GithubTeamPicker = (props: GithubTeamPickerProps) => {
    const {
        onChange,
        schema: {title = 'Github Team', description = 'Select a Github Team'},
        required,
        uiSchema,
        rawErrors,
        formData,
        idSchema,
    } = props;

    const catalogFilter = buildCatalogFilter(uiSchema);
    const defaultNamespace = uiSchema['ui:options']?.defaultNamespace || undefined;

    const catalogApi = useApi(catalogApiRef);
    const { value: entities, loading } = useAsync(async () => {
        const { items } = await catalogApi.getEntities(
            catalogFilter ? { filter: catalogFilter } : undefined,
        );
        return items;
    });

    const allowArbitrary = uiSchema['ui:options']?.allowArbitraryValues ?? false;
    const getLabel = useCallback(
        (ref: string) => {
            try {
                return humanizeEntityRef(
                    parseEntityRef(ref, { defaultKind: 'Group', defaultNamespace: 'default' }),
                    {
                        defaultKind: 'Group',
                        defaultNamespace: 'default'
                    },
                );
            } catch (err) {
                return ref;
            }
        },
        [defaultNamespace]
    )

    const onSelect = useCallback(
        (_: any, ref: string | Entity | null, reason: AutocompleteChangeReason) => {
          // ref can either be a string from free solo entry or
          if (typeof ref !== 'string') {
            // if ref does not exist: pass 'undefined' to trigger validation for required value
            onChange(ref ? humanizeEntityRef(ref, {defaultKind: 'group'}) : undefined);
          } else {
            if (reason === 'blur' || reason === 'create-option') {
              // Add in default namespace, etc.
              let entityRef = ref;
              try {
                // Attempt to parse the entity ref into it's full form.
                entityRef = stringifyEntityRef(
                  parseEntityRef(ref as string, {
                    defaultKind: 'group',
                    defaultNamespace,
                  }),
                );
              } catch (err) {
                // If the passed in value isn't an entity ref, do nothing.
              }
              // We need to check against formData here as that's the previous value for this field.
              if (formData !== ref || allowArbitrary) {
                onChange(entityRef);
              }
            }
          }
        },
        [onChange, formData, defaultNamespace, allowArbitrary],
    );

    useEffect(() => {
        if (entities?.length === 1) {
            onChange(stringifyEntityRef(entities[0]));
        }
    }, [entities, onChange]);

    return (
        <FormControl
          margin='normal'
          required
          error={rawErrors?.length > 0 && !formData}
        >
          <Autocomplete
            disabled={entities?.length === 1}
            id={idSchema.$id}
            value={
                entities?.find(e => stringifyEntityRef(e) === formData) ??
                (allowArbitrary && formData ? getLabel(formData) : '')
            }
            loading={loading}
            onChange={onSelect}
            options={entities || []}
            getOptionLabel={option =>
                typeof option === 'string' ? option : humanizeEntityRef(option, { defaultKind: 'Group', defaultNamespace })
            }
            autoSelect
            freeSolo={allowArbitrary}
            renderInput={params => (
                <TextField
                    {...params}
                    label={title}
                    margin='dense'
                    helperText={description}
                    FormHelperTextProps={{ margin: 'dense', style: { marginLeft: 0 } }}
                    variant='outlined'
                    required={required}
                    InputProps={params.InputProps}
                />
            )}
          />
        </FormControl>
    );
};

/**
 * Converts a especial `{exists: true}` value to the `CATALOG_FILTER_EXISTS` symbol.
 *
 * @param value - The value to convert.
 * @returns The converted value.
 */
function convertOpsValues(
    value: Exclude<GithubTeamPickerFilterQueryValue, Array<any>>,
  ): string | symbol {
    if (typeof value === 'object' && value.exists) {
      return CATALOG_FILTER_EXISTS;
    }
    return value?.toString();
  }

/**
 * Converts schema filters to entity filter query, replacing `{exists:true}` values
 * with the constant `CATALOG_FILTER_EXISTS`.
 *
 * @param schemaFilters - An object containing schema filters with keys as filter names
 * and values as filter values.
 * @returns An object with the same keys as the input object, but with `{exists:true}` values
 * transformed to `CATALOG_FILTER_EXISTS` symbol.
 */
function convertSchemaFiltersToQuery(
    schemaFilters: GithubTeamPickerFilterQuery,
  ): Exclude<EntityFilterQuery, Array<any>> {
    const query: EntityFilterQuery = {};
  
    for (const [key, value] of Object.entries(schemaFilters)) {
      if (Array.isArray(value)) {
        query[key] = value;
      } else {
        query[key] = convertOpsValues(value);
      }
    }
  
    return query;
  }
  

/**
 * Builds an `EntityFilterQuery` based on the `uiSchema` passed in.
 * If `catalogFilter` is specified in the `uiSchema`, it is converted to a `EntityFilterQuery`.
 * If `allowedKinds` is specified in the `uiSchema` will support the legacy `allowedKinds` option.
 *
 * @param uiSchema The `uiSchema` of an `EntityPicker` component.
 * @returns An `EntityFilterQuery` based on the `uiSchema`, or `undefined` if `catalogFilter` is not specified in the `uiSchema`.
 */
function buildCatalogFilter(
    uiSchema: GithubTeamPickerProps['uiSchema'],
): EntityFilterQuery | undefined {
    const catalogFilter: GithubTeamPickerUiOptions['catalogFilter'] | undefined =
      uiSchema['ui:options']?.catalogFilter;
  
    if (!catalogFilter) {
      return undefined;
    }
  
    if (Array.isArray(catalogFilter)) {
      return catalogFilter.map(convertSchemaFiltersToQuery);
    }
  
    return convertSchemaFiltersToQuery(catalogFilter);
}

export const GithubTeamPickerExtension =  scaffolderPlugin.provide(
    createScaffolderFieldExtension({
        name: 'GithubTeamPicker',
        component: GithubTeamPicker,
    }),
  );
