from scmtools.core import SCMException, FileNotFoundException, HEAD, SCMTool
import pysvn
import re

class SVNTool(SCMTool):
    def __init__(self, repopath):
        if repopath[-1] == '/':
            repopath = repopath[:-1]

        SCMTool.__init__(self, repopath)
        self.client = pysvn.Client()


    def get_file(self, path, revision=HEAD):
        if revision == HEAD:
            r = pysvn.Revision(pysvn.opt_revision_kind.head)
        else:
            r = pysvn.Revision(pysvn.opt_revision_kind.number, revision)

        try:
            return self.client.cat(self.__normalize_path(path), r)
        except pysvn.ClientError, e:
            raise FileNotFoundException(path, revision, str(e))


    def parse_diff_revision(self, revision_str):
        if revision_str == "(working copy)":
            return HEAD
        elif revision_str.startswith("(revision "):
            return revision_str.split()[1][:-1]
        else:
            raise SCMException("Unable to parse diff revision header '%s'" %
                               revision_str)


    def get_diff_header_info(self, header):
        diffheader = DiffHeader()
        diffheader.orig_file, diffheader.orig_revision = \
            self.__parse_diff_info_lne('---')
        diffheader.new_file, diffheader.new_revision = \
            self.__parse_diff_info_lne('+++')
        return diffheader


    def __parse_diff_info_line(self, prefix):
        pattern = re.compile(r'^%s ([^ ]+) *\((.*)\)' % prefix)
        result = pattern.search(header)
        if result == None:
            return None

        groups = result.groups()
        return groups[0], self.__parse_diff_revision(groups[1])


    def __parse_diff_revision(self, revision):
        if revision.startswith("revision "):
            return revision.split()[1]
        elif revision == "working copy":
            return HEAD
        else:
            raise SCMException("Unknown revision '%s'" % revision)


    def __normalize_path(self, path):
        if path.startswith(self.repopath):
            return path
        elif path[0] == '/':
            return self.repopath + path
        else:
            return self.repopath + "/" + path
