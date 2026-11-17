import { PersonLinesFill } from 'react-bootstrap-icons';

function ValidatorImage(props) {
  const { validator } = props
  const className = props.className || ''
  const defaultSize = !props.width || props.width > 30 ? 'lg' : 'sm'
  const imageUrl = validator.mintscan_image || validator.keybase_image
  const altText = validator.moniker || validator.description?.moniker || 'Validator'
  return (
    <>
      {imageUrl && imageUrl !== ''
        ? <img className={'rounded-circle border ' + className} width={props.width || 40} height={props.height || 40} src={imageUrl} alt={altText} />
        : <span className={`btn-circle btn-circle-${defaultSize} text-center bg-body-secondary rounded-circle border d-inline-flex align-items-center justify-content-center ` + className} aria-label={altText}><PersonLinesFill /></span>
          }
    </>
  );
}

export default ValidatorImage
