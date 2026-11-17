import ValidatorName from "./ValidatorName"
import { sanitizeUrl } from "../utils/Helpers.mjs"

function ValidatorLink(props) {
  let validator = props.validator
  if(!validator && props.operator) validator = props.operator
  if(!validator) return props.fallback || null

  const url = validator.description && validator.description.website
  const safeUrl = sanitizeUrl(url, { defaultHttps: true })

  if(!safeUrl){
    return props.children || <ValidatorName validator={validator} />
  }

  return (
    <a href={safeUrl} target="_blank" rel="noopener noreferrer" className={[props.className, "text-reset text-decoration-none"].join(' ')}>
      {props.children || <ValidatorName validator={validator} />}
    </a>
  );
}

export default ValidatorLink
