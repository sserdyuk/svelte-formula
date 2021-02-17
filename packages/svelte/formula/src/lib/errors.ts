import { FormEl, FormulaError } from '../types/forms';
import { ValidationFn, ValidationRule } from '../types/validation';
import { FormulaStores } from '../types/formula';
import { FormulaOptions } from '../types/options';

/**
 * The object returned by the {@link https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/Constraint_validation|Contraints Validation API} cannot
 * be enumerated, so we need to loop over the keys to extract them
 *
 * The key object is merged with any custom errors
 *
 * @private
 *
 * @param el The elements to read the constraints from
 * @param custom Custom error keys
 *
 * @returns An object containing keys for validity errors, set to true
 */
function extractErrors(el: FormEl, custom?: Record<string, boolean>): Record<string, boolean> {
  const output: any = {};
  for (let key in el.validity) {
    if (key !== 'valid') {
      // Skip the `valid` key so we only return errors
      if ((el.validity as any)[key]) {
        output[key] = (el.validity as any)[key];
      }
    }
  }
  return { ...output, ...custom };
}

/**
 * Check for custom messages contained in data attributes, or within the passed options
 * @param name
 * @param errors
 * @param el
 * @param messages
 */
function checkForCustomMessage(
  name: string,
  errors: Record<string, boolean>,
  el: FormEl,
  messages: Record<string, string>,
): string {
  return '';
  // Object.keys(errors).reduce((message, errorKey) => {
  //   if (dataSet[errorKey]) {
  //     return dataSet[errorKey];
  //   } else if (customMessages[errorKey]) {
  //     return customMessages[errorKey];
  //   }
  //     }, '');
}

function getCustomValidations(
  name: string,
  value: unknown | unknown[],
  validations: Record<string, ValidationFn> = {},
): [Record<string, string>, Record<string, boolean>] {
  let messages: Record<string, string> = {};
  let errors: Record<string, boolean> = {};

  if ((value !== '' || value !== null) && validations && validations[name]) {
    const customValidators = Object.entries(validations[name]);
    for (let i = 0; i < customValidators.length; i++) {
      const [name, validator] = customValidators[i];
      const message = validator(value);
      if (message !== null) {
        messages[name] = message;
        errors[name] = true;
      }
    }
  }
  return [messages, errors];
}

/**
 * Do form level validations
 * @param stores
 * @param customValidators
 */
export function createFormValidator(stores: FormulaStores, customValidators: ValidationRule) {
  const sub = stores.formValues.subscribe((values) => {
    stores.formValidity.set({});
    const validators = Object.entries(customValidators);
    for (let i = 0; i < validators.length; i++) {
      const [name, validator] = validators[i];
      const invalid = validator(values);
      if (invalid !== null) {
        stores.formValidity.update((state) => ({ ...state, [name]: invalid }));
        stores.isFormValid.set(false);
      }
    }
  });

  return () => sub();
}

/**
 * Create a validation checker for an element group - when an element has been updated.  If there are no options
 * just return the element validity. If there are options, check with custom validators if thet exist,
 * and also check for custom messages
 *
 * @private
 *
 * @param inputGroup The name of the group of elements that this validation message will update
 * @param options The passed formula options
 *
 * @returns Function that is called each time an element is updated which returns field validity state
 */
export function createValidationChecker(inputGroup: string, options?: FormulaOptions) {
  /**
   * Method called each time a field is updated
   *
   * @private
   *
   * @param el The element to validate against
   * @param elValue The value for the element
   *
   * @returns A Formula Error object
   */
  return (el: FormEl, elValue: unknown | unknown[]): FormulaError => {
    // Reset the validity
    el.setCustomValidity('');

    // If there's no options, just return the current error
    if (!options) {
      const valid = el.checkValidity();
      return {
        valid,
        invalid: !valid,
        message: el.validationMessage,
        errors: extractErrors(el),
      };
    }

    // Check for any custom messages in the options or dataset
    const customMessages = { ...options?.messages?.[inputGroup], ...el.dataset };
    // Check for any custom validations
    const [messages, customErrors] = getCustomValidations(inputGroup, elValue, options?.validators?.[inputGroup]);

    const errors = extractErrors(el, customErrors);
    const errorKeys = Object.keys(errors);
    // If there is no field validity issues, set custom ones
    if (el.checkValidity()) {
      if (errorKeys.length > 0) {
        el.setCustomValidity(messages[errorKeys[0]]);
      }
      // Check for custom messages
    } else {
      if (customMessages[errorKeys[0]]) {
        el.setCustomValidity(errorKeys[0]);
      }
    }
    // Recheck validity and show any messages
    const valid = el.checkValidity();
    return {
      valid,
      invalid: !valid,
      message: el.validationMessage,
      errors,
    };
  };
}
