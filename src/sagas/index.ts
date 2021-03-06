import { all, call, put, take } from 'redux-saga/effects'
import * as RS from 'redux-saga'
import _orderBy from 'lodash/orderBy'
import { Namespace, Namespaces  } from '../types/api'
import { fetchNamespaces, fetchDatasets, fetchJobs, fetchLatestJobRuns } from '../requests'
import { createRollbarMessage } from '../helpers'
import {
  fetchDatasetsSuccess,
  fetchJobsSuccess,
  fetchNamespacesSuccess,
  fetchJobRunsSuccess,
  applicationError
} from '../actionCreators'
import { FETCH_JOB_RUNS } from '../constants/ActionTypes'

export function* fetchNamespacesDatasetsAndJobs() {
  try {
    const response: Namespaces = yield call(fetchNamespaces)
    const { namespaces } = response

    const datasetResponses = yield all(namespaces.map((n: Namespace) => call(fetchDatasets, n)))

    const jobResponses = yield all(namespaces.map((n: Namespace) => call(fetchJobs, n)))
    const datasets = datasetResponses.flat()
    const jobs = jobResponses.flat()

    yield put(fetchDatasetsSuccess(datasets))
    yield put(fetchJobsSuccess(jobs))
    yield put(fetchNamespacesSuccess(namespaces))
  } catch (e) {
    createRollbarMessage('fetchNamespacesDatasetsAndJobs', e)
    yield put(applicationError('Something went wrong while fetching initial data.'))
  }
}

export function* fetchJobRunsSaga() {
  while (true) {
    try {
      const { payload } = yield take(FETCH_JOB_RUNS)
      const { runs } = yield call(fetchLatestJobRuns, payload.jobName, payload.namespace)
      const runsOrderedByStartTime = _orderBy(runs, ['nominalStartTime'], ['asc'])
      yield put(fetchJobRunsSuccess(payload.jobName, runsOrderedByStartTime))
    } catch (e) {
      createRollbarMessage('fetchJobRuns', e)
      yield put(applicationError('Something went wrong while fetching job runs'))
    }
  }
}

export default function* rootSaga(): Generator {
  const sagasThatAreKickedOffImmediately = [fetchNamespacesDatasetsAndJobs()]
  const sagasThatWatchForAction = [fetchJobRunsSaga()]

  yield all([...sagasThatAreKickedOffImmediately, ...sagasThatWatchForAction])
}
