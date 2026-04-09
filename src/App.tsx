import { Route, Routes } from 'react-router-dom'
import './App.css'
import HomePage from './pages/homepage'
import NotesPage from './pages/notes'
import MockExamPage from './pages/mockexam'
import MockExamPrepPage from './pages/mockexamprep'
import MockExamResultsPage from './pages/mockexamresults'
import PreviousExamsPage from './pages/previousexam'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/mockexam" element={<MockExamPage />} />
        <Route path="/mockexamprep" element={<MockExamPrepPage />} />
        <Route path='/mockexamresults' element={<MockExamResultsPage/>} />
        <Route path='/previousexams' element={<PreviousExamsPage />} />
      </Routes>
    </>
  )
}

export default App
