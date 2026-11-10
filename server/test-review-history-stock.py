import importlib.util,pathlib,tempfile,json,hashlib,unittest
p=pathlib.Path(__file__).with_name('review-history-stock.py');spec=importlib.util.spec_from_file_location('stock_review',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReviewGuardTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name)/'episode';self.root.mkdir();self.clips={}
  for i in range(4):
   path=self.root/f'{i}.mp4';path.write_bytes(f'video-{i}'.encode());self.clips[str(i)]={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceId':f'source-{i}'}
 def tearDown(self):self.temp.cleanup()
 def test_changed_file_cannot_be_approved(self):
  (self.root/'0.mp4').write_bytes(b'changed')
  with self.assertRaises(ValueError):m.validate_library(self.root,{'clips':self.clips},{'episodes':[]})
 def test_path_escape_is_rejected_before_file_is_read(self):
  self.clips['0']['file']='../outside.mp4'
  with self.assertRaises(ValueError):m.validate_library(self.root,{'clips':self.clips},{'episodes':[]})
 def test_previously_published_source_rejected(self):
  with self.assertRaises(ValueError):m.validate_library(self.root,{'clips':self.clips},{'episodes':[{'episode':'other','assets':['source-0']}]})
 def test_valid_distinct_local_package(self):self.assertEqual(len(m.validate_library(self.root,{'clips':self.clips},{'episodes':[]})),4)
if __name__=='__main__':unittest.main()
