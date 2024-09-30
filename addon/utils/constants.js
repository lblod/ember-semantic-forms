import { NamedNode } from 'rdflib';
import { Namespace } from 'rdflib';

export { MU, FORM, RDF, XSD } from '@lblod/submission-form-helpers';

export const FORM_GRAPH = new NamedNode('http://data.lblod.info/form');
export const META_GRAPH = new NamedNode('http://data.lblod.info/metagraph');
export const SOURCE_GRAPH = new NamedNode(`http://data.lblod.info/sourcegraph`);

export const JSON_API_TYPE = 'application/vnd.api+json';
// the resource cache is invalidated because of our form update, but the service doesn't wait for it before returning.
// this is a temporary hack while we wait for backend driven frontend revalidation
export const RESOURCE_CACHE_TIMEOUT = 1000;

export const EXT = new Namespace('http://mu.semte.ch/vocabularies/ext/');
export const ORG = new Namespace('http://www.w3.org/ns/org#');
